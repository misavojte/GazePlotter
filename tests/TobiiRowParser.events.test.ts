/**
 * Tobii event extraction — every non-denylisted Event-column row imports
 * as a DISCRETE event (duration 0); interval semantics are applied later
 * by the event-library merge tool, never in the parser. Pins the
 * consumption precedence (stimulus marker → denylist → occurrence), time
 * rebasing to the stimulus base time, and the drop policy for events
 * outside any stimulus.
 */
import { describe, it, expect } from 'vitest'
import {
  TOBII_HEADER,
  tobiiRow,
  runTobiiParser,
  type TobiiRowOpts,
} from './helpers/ingestAdapterHarness'

const HEADER = [...TOBII_HEADER, 'Fixation point X', 'Fixation point Y']

const row = (opts: TobiiRowOpts): string => tobiiRow(opts, HEADER)

const INTERVAL_CONFIG =
  '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}'

const run = (rows: string[], config: string, header: string[] = HEADER) =>
  runTobiiParser(rows, config, header)

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
      ...TOBII_HEADER.slice(0, 4),
      'Recording media name',
      ...TOBII_HEADER.slice(4),
      'Fixation point X',
      'Fixation point Y',
    ]
    const mediaRow = ({
      media,
      ...rest
    }: TobiiRowOpts & { media?: string }): string =>
      tobiiRow(
        media
          ? { ...rest, cells: { 'Recording media name': media } }
          : rest,
        mediaHeader
      )

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
    const noEventRow = (ts: number): string =>
      tobiiRow({ ts, gaze: true }, noEventHeader)
    const { events, warnings } = run(
      [noEventRow(1000), noEventRow(2000)],
      '',
      noEventHeader
    )
    expect(events).toEqual([])
    expect(warnings).toEqual([])
  })
})
