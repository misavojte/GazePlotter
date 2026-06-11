/**
 * Tobii inline event extraction — Event-column rows become event-channel
 * contributions. Pins the consumption precedence (stimulus marker →
 * denylist → end suffix → start suffix → bare), buffer-and-decide pairing,
 * time rebasing to the stimulus base time, and the drop/clamp policies.
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
}): string {
  const cells: string[] = new Array(HEADER.length).fill('')
  cells[0] = String(opts.ts)
  cells[2] = 'P1'
  cells[3] = 'R1'
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
const PAIRED_CONFIG =
  '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd","eventStartSuffix":" start","eventEndSuffix":" end"}'
const BARE_PAIRED_CONFIG =
  '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd","eventEndSuffix":" end"}'

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

describe('TobiiRowParser — inline event extraction', () => {
  it('imports discrete events rebased to the stimulus base time', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 3000, event: 'Click' }),
        row({ ts: 6000, gaze: true, catIdx: 2 }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      INTERVAL_CONFIG
    )

    expect(warnings).toEqual([])
    expect(events).toEqual([
      {
        stimulus: 'Stim1',
        participant: 'R1 P1',
        channel: 'Click',
        start: 2, // (3000µs − base 1000µs) → 2 ms
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

  it('fuses explicit start/end suffix pairs into one duration event', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 4000, event: 'Task start' }),
        row({ ts: 6000, gaze: true, catIdx: 2 }),
        row({ ts: 8000, event: 'Task end' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      PAIRED_CONFIG
    )

    expect(warnings).toEqual([])
    expect(events).toEqual([
      {
        stimulus: 'Stim1',
        participant: 'R1 P1',
        channel: 'Task',
        start: 3, // (4000 − 1000) µs → 3 ms
        duration: 4, // (8000 − 4000) µs → 4 ms
      },
    ])
  })

  it('buffer-and-decide: bare opens pair when closed, stay discrete when not', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 3000, event: 'Task' }),
        row({ ts: 4000, event: 'Click' }),
        row({ ts: 5000, event: 'Task end' }),
        row({ ts: 6000, gaze: true, catIdx: 2 }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      BARE_PAIRED_CONFIG
    )

    expect(warnings).toEqual([])
    expect(events).toContainEqual({
      stimulus: 'Stim1',
      participant: 'R1 P1',
      channel: 'Task',
      start: 2,
      duration: 2, // paired 3000→5000
    })
    // 'Click' never closed — it was a discrete event all along.
    expect(events).toContainEqual({
      stimulus: 'Stim1',
      participant: 'R1 P1',
      channel: 'Click',
      start: 3,
      duration: 0,
    })
    expect(events).toHaveLength(2)
  })

  it('clamps unclosed explicit opens to the recording end with a warning', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 4000, event: 'Task start' }),
        row({ ts: 6000, gaze: true, catIdx: 2 }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      PAIRED_CONFIG
    )

    expect(events).toEqual([
      {
        stimulus: 'Stim1',
        participant: 'R1 P1',
        channel: 'Task',
        start: 3,
        duration: 2, // clamped at last gaze timestamp 6000
      },
    ])
    expect(warnings).toEqual([
      '1 unclosed event(s) were clamped to the recording end',
    ])
  })

  it('warns on end markers with no matching start and drops them', () => {
    const { events, warnings } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 5000, event: 'Task end' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      PAIRED_CONFIG
    )
    expect(events).toEqual([])
    expect(warnings).toEqual([
      '1 event end marker(s) had no matching start',
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

  it('a second bare open resolves the first as discrete (repeated clicks)', () => {
    const { events } = run(
      [
        row({ ts: 1000, event: 'Stim1 IntervalStart' }),
        row({ ts: 2000, gaze: true }),
        row({ ts: 3000, event: 'Task' }),
        row({ ts: 4000, event: 'Task' }),
        row({ ts: 6000, event: 'Task end' }),
        row({ ts: 9000, event: 'Stim1 IntervalEnd' }),
      ],
      BARE_PAIRED_CONFIG
    )
    expect(events).toContainEqual(
      expect.objectContaining({ channel: 'Task', start: 2, duration: 0 })
    )
    expect(events).toContainEqual(
      expect.objectContaining({ channel: 'Task', start: 3, duration: 2 })
    )
    expect(events).toHaveLength(2)
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
