/**
 * Tobii event extraction — every non-denylisted Event-column row imports
 * as a DISCRETE event (duration 0); interval semantics are applied later
 * by the event-library merge tool, never in the parser. Pins the
 * consumption precedence (stimulus marker → denylist → occurrence), time
 * rebasing to the stimulus base time, and the drop policy for events
 * outside any stimulus.
 */
import { describe, it, expect } from 'vitest'
import { TobiiRowParser } from '$lib/data/ingest/formats/lib/rows/TobiiRowParser'
import type { EventContribution } from '$lib/data/ingest/kernel/sink'
import { processAdapterRows } from './helpers/ingestAdapterHarness'

const HEADER = [
  'Recording timestamp',
  'Sensor',
  'Participant name',
  'Recording name',
  'Event',
  'Eye movement type',
  'Eye movement type index',
  'Fixation point X',
  'Fixation point Y',
]

function row(opts: {
  ts: number
  event?: string
  gaze?: boolean
  catIdx?: number
  participant?: string
  recording?: string
}): string {
  const cells: string[] = new Array(HEADER.length).fill('')
  cells[0] = String(opts.ts)
  cells[2] = opts.participant ?? 'P1'
  cells[3] = opts.recording ?? 'R1'
  cells[4] = opts.event ?? ''
  if (opts.gaze) {
    cells[1] = 'Eye Tracker'
    cells[5] = 'Fixation'
    cells[6] = String(opts.catIdx ?? 1)
    cells[7] = '500'
    cells[8] = '500'
  }
  return cells.join('\t')
}

const INTERVAL_CONFIG =
  '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}'

function run(
  rows: string[],
  config: string,
  header: string[] = HEADER
): { events: EventContribution[]; warnings: string[] } {
  const parser = new TobiiRowParser(header, config, '\t')
  const events: EventContribution[] = []
  const warnings: string[] = []
  parser.onEvent = event => events.push(event)
  parser.onWarning = message => warnings.push(message)
  processAdapterRows(parser, rows, { finalize: true })
  return { events, warnings }
}

describe('TobiiRowParser — discrete event extraction', () => {
  it('imports every event as discrete, rebased to the stimulus base time', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 3000, event: 'Click' }),
        row({ ts: 4000, event: 'Task start' }),
        row({ ts: 6000, gaze: true, catIdx: 2 }),
        row({ ts: 8000, event: 'Task end' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      INTERVAL_CONFIG
    )

    expect(warnings).toEqual([])
    // Marker-style names get no special treatment — all discrete, verbatim.
    expect(events).toEqual([
      {
        stimulus: 'Stim1',
        participant: 'R1 P1',
        channel: 'Click',
        start: 2, // (3000µs − base 1000µs) → 2 ms
        duration: 0,
      },
      {
        stimulus: 'Stim1',
        participant: 'R1 P1',
        channel: 'Task start',
        start: 3,
        duration: 0,
      },
      {
        stimulus: 'Stim1',
        participant: 'R1 P1',
        channel: 'Task end',
        start: 7,
        duration: 0,
      },
    ])
  })

  it('never leaks stimulus markers or denylisted system events', () => {
    const { events } = run(
      [
        row({ ts: 500, event: 'RecordingStart' }),
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 3000, event: 'SyncPortOutHigh' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      INTERVAL_CONFIG
    )
    expect(events).toEqual([])
  })

  it('keeps recordings separate (participant names carry the recording)', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 3000, event: 'Click' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
        // Second recording restarts the clock — Tobii timestamps are
        // per-recording.
        row({ ts: 1000, event: 'Stim1 IntervalStart', recording: 'R2' }),
        row({ ts: 2000, gaze: true, catIdx: 2, recording: 'R2' }),
        row({ ts: 4000, event: 'Click', recording: 'R2' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd', recording: 'R2' }),
      ],
      INTERVAL_CONFIG
    )

    expect(warnings).toEqual([])
    expect(events).toEqual([
      expect.objectContaining({ participant: 'R1 P1', start: 2, duration: 0 }),
      expect.objectContaining({ participant: 'R2 P1', start: 3, duration: 0 }),
    ])
  })

  it('drops events outside any stimulus interval with a warning', () => {
    const { events, warnings } = run(
      [
        row({ ts: 500, event: 'Stray' }),
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      INTERVAL_CONFIG
    )
    expect(events).toEqual([])
    expect(warnings).toEqual([
      '1 event(s) occurred outside any stimulus and were dropped',
    ])
  })

  it('media mode: events attach to the current media stimulus', () => {
    const mediaHeader = [
      'Recording timestamp',
      'Sensor',
      'Participant name',
      'Recording name',
      'Recording media name',
      'Event',
      'Eye movement type',
      'Eye movement type index',
      'Fixation point X',
      'Fixation point Y',
    ]
    const mediaRow = (opts: {
      ts: number
      media?: string
      event?: string
      gaze?: boolean
      catIdx?: number
    }): string => {
      const cells: string[] = new Array(mediaHeader.length).fill('')
      cells[0] = String(opts.ts)
      cells[2] = 'P1'
      cells[3] = 'R1'
      cells[4] = opts.media ?? ''
      cells[5] = opts.event ?? ''
      if (opts.gaze) {
        cells[1] = 'Eye Tracker'
        cells[6] = 'Fixation'
        cells[7] = String(opts.catIdx ?? 1)
        cells[8] = '500'
        cells[9] = '500'
      }
      return cells.join('\t')
    }

    const { events, warnings } = run(
      [
        mediaRow({ ts: 1000, media: 'img.png', gaze: true }),
        mediaRow({ ts: 1500, event: 'Click' }),
        mediaRow({ ts: 2000, media: 'img.png', gaze: true, catIdx: 2 }),
      ],
      '',
      mediaHeader
    )

    expect(warnings).toEqual([])
    expect(events).toEqual([
      {
        stimulus: 'img.png',
        participant: 'R1 P1',
        channel: 'Click',
        start: 0.5,
        duration: 0,
      },
    ])
  })

  it("the plain 'tobii' variant (no Event column) extracts nothing", () => {
    const noEventHeader = HEADER.filter(name => name !== 'Event')
    const noEventRow = (ts: number): string => {
      const cells: string[] = new Array(noEventHeader.length).fill('')
      cells[0] = String(ts)
      cells[1] = 'Eye Tracker'
      cells[2] = 'P1'
      cells[3] = 'R1'
      cells[4] = 'Fixation'
      cells[5] = '1'
      return cells.join('\t')
    }
    const { events, warnings } = run(
      [noEventRow(1000), noEventRow(2000)],
      '',
      noEventHeader
    )
    expect(events).toEqual([])
    expect(warnings).toEqual([])
  })
})
