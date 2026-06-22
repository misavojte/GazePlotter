/**
 * Interval-stimulus marker validation. When `-0`/`-1` (or any suffix pair)
 * markers form stimuli, a participant's data for an interval is only valid if
 * that interval's starts and ends pair by strict alternation. A malformed
 * sequence — a second start while one is open, an end with none open, or a
 * start that never ends — gives the interval an undefined extent, so that
 * (stimulus, participant) is dropped ENTIRELY: its segments, its events, and
 * any AOI only it referenced. A persisted exclusion notice records why. Clean
 * groups are untouched. Mirrors `pairIntervalTimes` (`$lib/data/intervalPairing`).
 */
import { describe, it, expect } from 'vitest'
import { TobiiRowParser } from '$lib/data/ingest/formats/lib/rows/TobiiRowParser'
import { DatasetBuilder } from '$lib/data/ingest/kernel/sink'
import { BinaryBufferReader } from '$lib/data/binary'
import type { ParseSettings } from '$lib/data/ingest/types'
import { processAdapterRows } from './helpers/ingestAdapterHarness'

const HEADER = [
  'Recording timestamp',
  'Sensor',
  'Participant name',
  'Recording name',
  'Event',
  'Eye movement type',
  'Eye movement type index',
  'AOI hit [scene - X]',
  'AOI hit [scene - Y]',
]
const AOI_COL = { X: 7, Y: 8 } as const
const CONFIG = '{"stimulusStartSuffix":"-0","stimulusEndSuffix":"-1"}'
const SETTINGS: ParseSettings = {
  type: 'tobii-with-event',
  rowDelimiter: '\n',
  columnDelimiter: '\t',
  encoding: 'utf-8',
  userInputSetting: CONFIG,
  headerRowId: 0,
}

const evt = (ts: number, event: string, p = 'P1', r = 'R1'): string => {
  const c = new Array(HEADER.length).fill('')
  c[0] = String(ts)
  c[2] = p
  c[3] = r
  c[4] = event
  return c.join('\t')
}
const gaze = (
  ts: number,
  idx: number,
  p = 'P1',
  r = 'R1',
  aoi: Array<keyof typeof AOI_COL> = []
): string => {
  const c = new Array(HEADER.length).fill('')
  c[0] = String(ts)
  c[1] = 'Eye Tracker'
  c[2] = p
  c[3] = r
  c[5] = 'Fixation'
  c[6] = String(idx)
  for (const name of aoi) c[AOI_COL[name]] = '1'
  return c.join('\t')
}

/** Drive a parse through the real DatasetBuilder so exclusions drop segments,
 *  events, and orphaned AOIs, and accrue the persisted `dataExclusions`. */
function wire(parser: TobiiRowParser, sink: DatasetBuilder): void {
  parser.onSegment = sink.addSegmentBytes
  parser.onEvent = e => sink.addEvent(e)
  parser.onBeginProvisionalGroup = (s, p) => sink.beginProvisionalGroup(s, p)
  parser.onCommitProvisionalGroup = h => sink.commitProvisionalGroup(h)
  parser.onDropProvisionalGroup = h => sink.dropProvisionalGroup(h)
  parser.onRecordExclusion = (s, p, issues) => sink.recordExclusion(s, p, issues)
  parser.onWarning = m => sink.addWarning(m)
}

function run(rows: string[]) {
  const parser = new TobiiRowParser(HEADER, CONFIG, '\t')
  const sink = new DatasetBuilder()
  sink.beginFile(SETTINGS)
  wire(parser, sink)
  processAdapterRows(parser, rows, { finalize: true })

  const data = sink.buildFinalData()
  const reader = new BinaryBufferReader(data.segments)
  const sIdx = new Map(data.stimuli.data.map((r, i) => [r[0], i] as const))
  const pIdx = new Map(data.participants.data.map((r, i) => [r[0], i] as const))
  const segmentCount = (stimulus: string, participant: string): number => {
    const s = sIdx.get(stimulus)
    const p = pIdx.get(participant)
    if (s === undefined || p === undefined) return 0
    let n = 0
    reader.forEachSegment(s, p, () => {
      n++
    })
    return n
  }
  const eventCount = (stimulus: string, participant: string): number => {
    const s = sIdx.get(stimulus)
    const p = pIdx.get(participant)
    if (s === undefined || p === undefined) return 0
    let n = 0
    for (const channel of data.eventData.events[s] ?? [])
      n += (channel[p]?.length ?? 0) / 2
    return n
  }
  const aoiNames = (stimulus: string): string[] => {
    const s = sIdx.get(stimulus)
    return s === undefined ? [] : (data.aois.data[s] ?? []).map(a => a[0])
  }
  const aoisOf = (stimulus: string, participant: string): string[] => {
    const s = sIdx.get(stimulus)
    const p = pIdx.get(participant)
    if (s === undefined || p === undefined) return []
    const out = new Set<string>()
    reader.forEachSegment(s, p, i => {
      for (const a of reader.getRawAois(i)) out.add(data.aois.data[s][a][0])
    })
    return [...out]
  }
  const segmentExtents = (
    stimulus: string,
    participant: string
  ): Array<[number, number]> => {
    const s = sIdx.get(stimulus)
    const p = pIdx.get(participant)
    if (s === undefined || p === undefined) return []
    const out: Array<[number, number]> = []
    reader.forEachSegment(s, p, i => {
      out.push([reader.getSegmentStart(i), reader.getSegmentEnd(i)])
    })
    return out
  }
  return {
    exclusions: data.dataExclusions ?? [],
    segmentCount,
    eventCount,
    aoiNames,
    aoisOf,
    segmentExtents,
  }
}

describe('TobiiRowParser — interval-stimulus marker validation', () => {
  it('keeps a cleanly paired interval and records no exclusion', () => {
    const { exclusions, segmentCount } = run([
      evt(1000, 'A-0'),
      gaze(2000, 1),
      evt(3000, 'A-1'),
    ])
    expect(segmentCount('A', 'R1 P1')).toBeGreaterThan(0)
    expect(exclusions).toEqual([])
  })

  it('excludes and records a double start (new start while one is open)', () => {
    const { exclusions, segmentCount } = run([
      evt(1000, 'B-0'),
      gaze(2000, 1),
      evt(3000, 'B-0'), // second open without an intervening close
      gaze(4000, 2),
      evt(5000, 'B-1'),
    ])
    expect(segmentCount('B', 'R1 P1')).toBe(0)
    expect(exclusions).toHaveLength(1)
    expect(exclusions[0].stimulus).toBe('B')
    expect(exclusions[0].participant).toBe('R1 P1')
    expect(exclusions[0].issues.map(i => i.kind)).toContain('double-start')
  })

  it('excludes and records an orphan end (end with no open start)', () => {
    const { exclusions, segmentCount } = run([
      evt(1000, 'C-0'),
      gaze(2000, 1),
      evt(3000, 'C-1'),
      evt(4000, 'C-1'), // stray end, nothing open
    ])
    expect(segmentCount('C', 'R1 P1')).toBe(0)
    expect(exclusions[0].issues.map(i => i.kind)).toContain('orphan-end')
  })

  it('excludes and records an unclosed start (start that never ends)', () => {
    const { exclusions, segmentCount } = run([evt(1000, 'D-0'), gaze(2000, 1)])
    expect(segmentCount('D', 'R1 P1')).toBe(0)
    expect(exclusions[0].issues.map(i => i.kind)).toContain('unclosed-start')
    expect(exclusions[0].issues[0].timeSeconds).toBeCloseTo(0.001, 5)
  })

  it('excludes only the impacted participant, keeping clean ones for the same stimulus', () => {
    const { exclusions, segmentCount } = run([
      evt(1000, 'E-0', 'Y1', 'Rec1'),
      gaze(2000, 1, 'Y1', 'Rec1'),
      evt(3000, 'E-1', 'Y1', 'Rec1'),
      evt(4000, 'E-0', 'Y2', 'Rec2'),
      gaze(5000, 1, 'Y2', 'Rec2'),
    ])
    expect(segmentCount('E', 'Rec1 Y1')).toBeGreaterThan(0)
    expect(segmentCount('E', 'Rec2 Y2')).toBe(0)
    expect(exclusions).toHaveLength(1)
    expect(exclusions[0].participant).toBe('Rec2 Y2')
  })

  it('drops events that belong to an excluded group but keeps a clean group’s', () => {
    const { segmentCount, eventCount } = run([
      // Clean interval F: a 'Click' event lands inside it.
      evt(1000, 'F-0'),
      evt(1500, 'Click'),
      gaze(2000, 1),
      evt(3000, 'F-1'),
      // Unclosed interval G: its 'Click' must not survive.
      evt(4000, 'G-0'),
      evt(4500, 'Click'),
      gaze(5000, 1),
    ])
    expect(segmentCount('F', 'R1 P1')).toBeGreaterThan(0)
    expect(eventCount('F', 'R1 P1')).toBe(1)
    expect(segmentCount('G', 'R1 P1')).toBe(0)
    expect(eventCount('G', 'R1 P1')).toBe(0)
  })

  it('prunes an AOI only the excluded participant hit, keeping the survivor’s', () => {
    const { segmentCount, aoiNames } = run([
      // Participant Pa: clean interval H, hits AOI X.
      evt(1000, 'H-0', 'Pa', 'Ra'),
      gaze(2000, 1, 'Pa', 'Ra', ['X']),
      evt(3000, 'H-1', 'Pa', 'Ra'),
      // Participant Pb: interval H never closes, and is the only one hitting Y.
      evt(4000, 'H-0', 'Pb', 'Rb'),
      gaze(5000, 1, 'Pb', 'Rb', ['Y']),
    ])
    expect(segmentCount('H', 'Ra Pa')).toBeGreaterThan(0)
    expect(segmentCount('H', 'Rb Pb')).toBe(0)
    // Y was referenced only by the excluded participant; it must not linger.
    expect(aoiNames('H')).toEqual(['X'])
  })

  it('keeps participants’ gaze separate when an interval reopens with a coinciding index', () => {
    // Both participants hit movement index 1 inside interval I (Tobii indices
    // restart per recording). The open segment must not carry across the
    // participant boundary, or Pb's AOI would bleed into Pa's segment.
    const { segmentCount, aoisOf } = run([
      evt(1000, 'I-0', 'Pa', 'Ra'),
      gaze(2000, 1, 'Pa', 'Ra', ['X']),
      evt(3000, 'I-1', 'Pa', 'Ra'),
      evt(4000, 'I-0', 'Pb', 'Rb'),
      gaze(5000, 1, 'Pb', 'Rb', ['Y']),
      evt(6000, 'I-1', 'Pb', 'Rb'),
    ])
    expect(segmentCount('I', 'Ra Pa')).toBeGreaterThan(0)
    expect(segmentCount('I', 'Rb Pb')).toBeGreaterThan(0)
    expect(aoisOf('I', 'Ra Pa')).toEqual(['X'])
    expect(aoisOf('I', 'Rb Pb')).toEqual(['Y'])
  })

  it('excludes an unclosed outer interval while keeping its cleanly-closed inner one', () => {
    const { exclusions, segmentCount } = run([
      evt(1000, 'Out-0', 'Pa', 'Ra'),
      evt(1500, 'In-0', 'Pa', 'Ra'), // nested inside Out
      gaze(2000, 1, 'Pa', 'Ra'),
      evt(2500, 'In-1', 'Pa', 'Ra'), // In closes cleanly
      gaze(3000, 2, 'Pa', 'Ra'),
      // Out never closes
    ])
    expect(segmentCount('In', 'Ra Pa')).toBeGreaterThan(0)
    expect(segmentCount('Out', 'Ra Pa')).toBe(0)
    expect(exclusions).toHaveLength(1)
    expect(exclusions[0].stimulus).toBe('Out')
    expect(exclusions[0].issues.map(i => i.kind)).toContain('unclosed-start')
  })

  it('does not let an unclosed interval bleed its extent onto a later participant', () => {
    // Pa opens interval Z and never closes it; the parser's interval stack is
    // shared, so Pb's gaze (Pb never opened Z) would otherwise be attributed to
    // Z and run the length of Pb's recording. Pb's Z group has no markers to
    // validate, so it must be dropped — only confirmed-valid data survives.
    const { exclusions, segmentCount } = run([
      evt(1000, 'Z-0', 'Pa', 'Ra'),
      gaze(2000, 1, 'Pa', 'Ra'),
      // Pb: gaze only, no Z markers.
      gaze(9000, 1, 'Pb', 'Rb'),
      gaze(9100, 1, 'Pb', 'Rb'),
    ])
    expect(segmentCount('Z', 'Ra Pa')).toBe(0) // Pa's Z is unclosed
    expect(segmentCount('Z', 'Rb Pb')).toBe(0) // Pb never opened Z — no bleed
    expect(exclusions).toHaveLength(1)
    expect(exclusions[0].stimulus).toBe('Z')
    expect(exclusions[0].participant).toBe('Ra Pa')
    expect(exclusions[0].issues.map(i => i.kind)).toContain('unclosed-start')
  })

  it('bases a reused interval at its own start, even after a prior participant left it unclosed', () => {
    // Pb reuses interval name W. Whether or not Pa left W unclosed, Pb's W must
    // be based at Pb's IntervalStart marker (1_000_000), not at Pb's first gaze
    // (1_010_000) — i.e. a stale open interval from Pa must not steal Pb's open
    // slot and skip the start-time correction. The two runs must be identical.
    const pbBlock = [
      evt(1_000_000, 'W-0', 'Pb', 'Rb'),
      gaze(1_010_000, 1, 'Pb', 'Rb'),
      gaze(1_026_700, 1, 'Pb', 'Rb'),
      gaze(1_043_400, 1, 'Pb', 'Rb'),
      evt(1_100_000, 'W-1', 'Pb', 'Rb'),
    ]
    const clean = run([
      evt(100_000, 'W-0', 'Pa', 'Ra'),
      gaze(110_000, 1, 'Pa', 'Ra'),
      evt(200_000, 'W-1', 'Pa', 'Ra'), // Pa closes W
      ...pbBlock,
    ])
    const stale = run([
      evt(100_000, 'W-0', 'Pa', 'Ra'),
      gaze(110_000, 1, 'Pa', 'Ra'),
      // Pa never closes W
      ...pbBlock,
    ])
    const cleanPb = clean.segmentExtents('W', 'Rb Pb')
    const stalePb = stale.segmentExtents('W', 'Rb Pb')
    expect(cleanPb.length).toBeGreaterThan(0)
    expect(stalePb).toEqual(cleanPb) // prior unclosed W must not shift Pb's timing
    expect(stalePb[0][0]).toBe(0) // first segment starts at the interval origin
  })

  it('a later file may validly fill a group a previous file dropped as invalid', () => {
    // Two Tobii files in one upload share the sink. File 1's (A, R1 P1) is
    // unclosed (dropped); File 2 supplies a clean (A, R1 P1). The valid data
    // must survive and File 1's exclusion notice must persist.
    const sink = new DatasetBuilder()

    const p1 = new TobiiRowParser(HEADER, CONFIG, '\t')
    sink.beginFile(SETTINGS)
    wire(p1, sink)
    processAdapterRows(p1, [evt(1000, 'A-0'), gaze(2000, 1)], { finalize: true })

    const p2 = new TobiiRowParser(HEADER, CONFIG, '\t')
    sink.beginFile(SETTINGS)
    wire(p2, sink)
    processAdapterRows(p2, [evt(1000, 'A-0'), gaze(2000, 1), evt(3000, 'A-1')], {
      finalize: true,
    })

    const data = sink.buildFinalData()
    const reader = new BinaryBufferReader(data.segments)
    const s = data.stimuli.data.findIndex(r => r[0] === 'A')
    const p = data.participants.data.findIndex(r => r[0] === 'R1 P1')
    let count = 0
    reader.forEachSegment(s, p, () => {
      count++
    })
    expect(count).toBeGreaterThan(0) // File 2's valid data survives
    expect(data.dataExclusions ?? []).toHaveLength(1) // File 1's notice persists
    expect(data.dataExclusions?.[0].issues.map(i => i.kind)).toContain(
      'unclosed-start'
    )
  })
})
