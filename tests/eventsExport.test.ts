import { describe, expect, it } from 'vitest'
import type { DataType } from '../src/lib/data/types'
import { jsonSegmentsToBinary } from '../src/lib/data/binary'
import { INTERVAL_CHANNEL_MARKER } from '../src/lib/data/engine/eventIntervals'
import {
  generateEventUnifiedCsv,
  generateEventBatchCsv,
} from '../src/lib/data/export/mappers/events'
import {
  detectCsvEventHeader,
  parseCsvEventText,
} from '../src/lib/data/ingest/formats/csvEvent'

/**
 * Dataset with:
 * - Two channels grouped by displayed name (Click + Tap -> "Action")
 * - A hidden channel (Blink)
 * - A derived interval channel (TaskInterval -> displayed "Task")
 * Two participants, one stimulus.
 */
function createEventData(): DataType {
  return {
    isOrdinalOnly: false,
    capabilities: { segmented: false, spatial: false, event: true },
    stimuli: { data: [['S1', 'StimulusOne']], orderVector: [0] },
    participants: {
      data: [
        ['Alice', 'AliceDisplay'],
        ['Bob', 'BobDisplay'],
      ],
      orderVector: [0, 1],
    },
    participantsGroups: [],
    metricInstances: [],
    categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [0] },
    noAoiTreatment: { displayedName: 'No AOI', color: '#cbd5e1' },
    aois: { data: [[]], orderVector: [[]], hiddenAois: [[]] },
    segments: jsonSegmentsToBinary([[[], []]]),
    eventData: {
      data: [
        [
          ['Click', 'Action', '#111'],
          ['Tap', 'Action', '#222'],
          ['Blink', 'Blink', '#333'],
          ['TaskInterval', 'Task', '#444', INTERVAL_CHANNEL_MARKER],
        ],
      ],
      orderVector: [[0, 1, 2, 3]],
      hiddenChannels: [[2]],
      events: [
        [
          [[10, 0, 50, 0], [30, 0]], // ch0 Click: Alice, Bob
          [[20, 0], []], // ch1 Tap: Alice, Bob
          [[5, 0], []], // ch2 Blink (hidden): Alice, Bob
          [[0, 100], [200, 50]], // ch3 Task interval: Alice, Bob
        ],
      ],
    },
  }
}

describe('event export — displayed naming', () => {
  it('groups channels by displayed name, includes intervals, drops hidden, uses displayed stimulus/participant', () => {
    const csv = generateEventUnifiedCsv(createEventData())

    expect(csv).toBe(
      [
        'stimulus,participant,eventName,start,duration',
        'StimulusOne,AliceDisplay,Task,0,100',
        'StimulusOne,AliceDisplay,Action,10,0',
        'StimulusOne,AliceDisplay,Action,20,0',
        'StimulusOne,AliceDisplay,Action,50,0',
        'StimulusOne,BobDisplay,Action,30,0',
        'StimulusOne,BobDisplay,Task,200,50',
      ].join('\n')
    )
  })

  it('preserves an explicitly cleared displayed name as an empty label', () => {
    // Matches the on-screen render: a channel whose displayed name was cleared
    // shows an empty label, it does not fall back to the original name.
    const data = createEventData()
    data.eventData.data[0][0] = ['Click', '', '#111']

    const csv = generateEventUnifiedCsv(data, undefined, undefined, 'displayed')
    // ch0 ("Click") now stands alone with an empty label; its first occurrence
    // for Alice is at t=10. The empty event field is the on-screen result.
    expect(csv).toContain('StimulusOne,AliceDisplay,,10,0')
  })

  it('honours delimiter formatting', () => {
    const csv = generateEventUnifiedCsv(createEventData(), undefined, {
      delimiter: ';',
    })
    expect(csv.split('\n')[0]).toBe(
      'stimulus;participant;eventName;start;duration'
    )
    expect(csv.split('\n')[1]).toBe('StimulusOne;AliceDisplay;Task;0;100')
  })
})

describe('event export — raw naming', () => {
  it('uses original names, keeps hidden, excludes derived interval channels, uses raw stimulus/participant', () => {
    const csv = generateEventUnifiedCsv(createEventData(), undefined, undefined, 'raw')

    expect(csv).toBe(
      [
        'stimulus,participant,eventName,start,duration',
        'S1,Alice,Blink,5,0',
        'S1,Alice,Click,10,0',
        'S1,Alice,Tap,20,0',
        'S1,Alice,Click,50,0',
        'S1,Bob,Click,30,0',
      ].join('\n')
    )
  })
})

describe('event export — batch and selection', () => {
  it('emits one CSV per participant/stimulus', () => {
    const batch = generateEventBatchCsv(createEventData())

    expect(batch.map(b => b.fileName)).toEqual(['StimulusOne_AliceDisplay', 'StimulusOne_BobDisplay'])

    const alice = batch.find(b => b.fileName === 'StimulusOne_AliceDisplay')!
    expect(alice.content).toBe(
      [
        'eventName,start,duration',
        'Task,0,100',
        'Action,10,0',
        'Action,20,0',
        'Action,50,0',
      ].join('\n')
    )
  })

  it('respects the stimulus selection set', () => {
    const csv = generateEventUnifiedCsv(createEventData(), new Set(['1']))
    expect(csv).toBe('stimulus,participant,eventName,start,duration')
  })
})

describe('event export — re-import round trip', () => {
  it('is detected and parsed by the CSV event-enrichment importer', () => {
    const csv = generateEventUnifiedCsv(createEventData())

    // The exported header must be recognised as an event file on upload.
    expect(detectCsvEventHeader(csv.split('\n')[0])).toBe(true)

    const { contributions, warnings } = parseCsvEventText(csv)
    expect(warnings).toEqual([])
    // Displayed export bakes in grouping/renames: Click+Tap -> "Action",
    // the interval channel -> "Task"; Blink (hidden) is dropped.
    expect(contributions).toEqual([
      { stimulus: 'StimulusOne', participant: 'AliceDisplay', channel: 'Task', start: 0, duration: 100 },
      { stimulus: 'StimulusOne', participant: 'AliceDisplay', channel: 'Action', start: 10, duration: 0 },
      { stimulus: 'StimulusOne', participant: 'AliceDisplay', channel: 'Action', start: 20, duration: 0 },
      { stimulus: 'StimulusOne', participant: 'AliceDisplay', channel: 'Action', start: 50, duration: 0 },
      { stimulus: 'StimulusOne', participant: 'BobDisplay', channel: 'Action', start: 30, duration: 0 },
      { stimulus: 'StimulusOne', participant: 'BobDisplay', channel: 'Task', start: 200, duration: 50 },
    ])
  })
})
