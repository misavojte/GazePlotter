import { describe, expect, it } from 'vitest'
import type { DataType } from '../src/lib/data/types'
import { jsonSegmentsToBinary } from '../src/lib/data/binary'
import { generateUnifiedCsv } from '../src/lib/data/export/mappers/segments'

/**
 * One segment referencing three AOIs:
 * - AOI 0 "Left" and AOI 1 "Right" share the displayed name "Region" (grouped)
 * - AOI 2 "Top" is hidden
 * Category 0 is imported as "Fixation" but renamed (displayed) to "Gaze".
 */
function createData(): DataType {
  return {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    stimuli: { data: [['S1', 'StimulusOne']], orderVector: [0] },
    participants: { data: [['P1', 'ParticipantOne']], orderVector: [0] },
    participantsGroups: [],
    metricInstances: [],
    categories: { data: [['Fixation', 'Gaze', '#000000']], orderVector: [0] },
    noAoiTreatment: { displayedName: 'No AOI', color: '#cbd5e1' },
    aois: {
      data: [
        [
          ['Left', 'Region', '#ff0000'],
          ['Right', 'Region', '#00ff00'],
          ['Top', 'Top Area', '#0000ff'],
        ],
      ],
      orderVector: [[0, 1, 2]],
      hiddenAois: [[2]],
    },
    segments: jsonSegmentsToBinary([[[[0, 100, 0, 0, 1, 2]]]]),
    eventData: { data: [[]], orderVector: [], hiddenChannels: [], events: [[]] },
  }
}

describe('segment export naming', () => {
  it('displayed (default): renamed category, grouped+deduped AOIs, hidden dropped, displayed stimulus/participant', () => {
    const lines = generateUnifiedCsv(createData()).split('\n')
    expect(lines[1]).toBe('StimulusOne,ParticipantOne,0,100,Gaze,Region')
  })

  it('raw: original category name, every AOI listed (incl. hidden), no grouping, raw stimulus/participant', () => {
    const lines = generateUnifiedCsv(
      createData(),
      undefined,
      false,
      undefined,
      'raw'
    ).split('\n')
    expect(lines[1]).toBe('S1,P1,0,100,Fixation,Left;Right;Top')
  })
})
