/**
 * Regression test: newer Tobii Pro Lab exports append unit suffixes in square
 * brackets to several quantitative columns (e.g. `Recording timestamp [ms]`,
 * `Fixation point X [DACS px]`). The adapter must accept both the bare and the
 * suffixed forms.
 *
 * @see $lib/data/ingest/stream/adapters/TobiiAdapter.ts
 */
import { describe, it, expect } from 'vitest'
import { TobiiAdapter } from '$lib/data/ingest/stream/adapters/TobiiAdapter'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

type HeaderForms = {
  ts: string
  fx: string
  fy: string
}

const FORMS = {
  bare: { ts: 'Recording timestamp', fx: 'Fixation point X', fy: 'Fixation point Y' },
  suffixed: {
    ts: 'Recording timestamp [ms]',
    fx: 'Fixation point X [DACS px]',
    fy: 'Fixation point Y [DACS px]',
  },
} as const

function buildHeader(forms: HeaderForms): string[] {
  return [
    forms.ts,
    'Sensor',
    'Participant name',
    'Recording name',
    'Recording media name',
    'Eye movement type',
    'Eye movement type index',
    forms.fx,
    forms.fy,
  ]
}

function buildRows(header: string[]): string[] {
  const idxTs = 0
  const idxSensor = header.indexOf('Sensor')
  const idxPart = header.indexOf('Participant name')
  const idxRec = header.indexOf('Recording name')
  const idxMedia = header.indexOf('Recording media name')
  const idxEMT = header.indexOf('Eye movement type')
  const idxEMTIdx = header.indexOf('Eye movement type index')
  // The fixation cols are at positions 7/8 by our construction; resolve by
  // suffix/exact via the same logic the adapter uses
  const idxFx = header.findIndex(
    h => h === 'Fixation point X' || h.startsWith('Fixation point X [')
  )
  const idxFy = header.findIndex(
    h => h === 'Fixation point Y' || h.startsWith('Fixation point Y [')
  )

  function row(ts: number, fx: number, fy: number): string {
    const cells = new Array(header.length).fill('')
    cells[idxTs] = String(ts)
    cells[idxSensor] = 'Eye Tracker'
    cells[idxPart] = 'P1'
    cells[idxRec] = 'R1'
    cells[idxMedia] = 'scene.mp4'
    cells[idxEMT] = 'Fixation'
    cells[idxEMTIdx] = '1'
    cells[idxFx] = String(fx)
    cells[idxFy] = String(fy)
    return cells.join('\t')
  }

  return [
    row(1_000_000, 100, 200),
    row(1_005_000, 100, 200),
    row(1_010_000, 100, 200),
  ]
}

function runAdapter(header: string[], rows: string[]) {
  const adapter = new TobiiAdapter(header, '', '\t')
  const { outputs, processRows } = createAdapterHarness(adapter)
  processRows(rows, { finalize: true })
  return outputs
}

describe('TobiiAdapter — unit-suffixed header tolerance', () => {
  it('all bare names → emits segments with correct spatial coords', () => {
    const header = buildHeader(FORMS.bare)
    const outputs = runAdapter(header, buildRows(header))
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs.every(o => o.stimulus === 'scene.mp4')).toBe(true)
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
  })

  it('all unit-suffixed names → emits segments with correct spatial coords', () => {
    const header = buildHeader(FORMS.suffixed)
    const outputs = runAdapter(header, buildRows(header))
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs.every(o => o.stimulus === 'scene.mp4')).toBe(true)
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
  })

  it('mixed: suffixed timestamp + bare fixation → emits segments', () => {
    const header = buildHeader({
      ts: FORMS.suffixed.ts,
      fx: FORMS.bare.fx,
      fy: FORMS.bare.fy,
    })
    const outputs = runAdapter(header, buildRows(header))
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
  })

  it('mixed: bare timestamp + suffixed fixation → emits segments', () => {
    const header = buildHeader({
      ts: FORMS.bare.ts,
      fx: FORMS.suffixed.fx,
      fy: FORMS.suffixed.fy,
    })
    const outputs = runAdapter(header, buildRows(header))
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
  })

  it('[μs] timestamp produces correct millisecond durations', () => {
    const header = buildHeader({
      ts: 'Recording timestamp [μs]',
      fx: FORMS.bare.fx,
      fy: FORMS.bare.fy,
    })
    const idxFx = header.indexOf('Fixation point X')
    const idxFy = header.indexOf('Fixation point Y')
    const baseRow = buildRows(header)[0].split('\t')
    const rows = [1_000_000, 1_005_000, 1_010_000, 1_015_000].map(ts => {
      const cells = [...baseRow]
      cells[0] = String(ts)
      cells[idxFx] = '100'
      cells[idxFy] = '200'
      return cells.join('\t')
    })
    const outputs = runAdapter(header, rows)
    expect(outputs.length).toBe(1)
    expect(outputs[0].start).toBe(0)
    // 4 rows at 5000µs apart → sampInt=5000 → end = (15000 + 2500) * 0.001
    expect(outputs[0].end).toBeCloseTo(17.5, 6)
  })

  it('[ms] timestamp is scaled to µs and produces the same durations as [μs]', () => {
    const header = buildHeader({
      ts: 'Recording timestamp [ms]',
      fx: FORMS.bare.fx,
      fy: FORMS.bare.fy,
    })
    const idxFx = header.indexOf('Fixation point X')
    const idxFy = header.indexOf('Fixation point Y')
    const baseRow = buildRows(header)[0].split('\t')
    // Same semantic durations as the µs test above, expressed in ms.
    const rows = [1000, 1005, 1010, 1015].map(ts => {
      const cells = [...baseRow]
      cells[0] = String(ts)
      cells[idxFx] = '100'
      cells[idxFy] = '200'
      return cells.join('\t')
    })
    const outputs = runAdapter(header, rows)
    expect(outputs.length).toBe(1)
    expect(outputs[0].start).toBe(0)
    expect(outputs[0].end).toBeCloseTo(17.5, 6)
  })

  it('near-miss `Recording timestampX [ms]` must NOT match `Recording timestamp`', () => {
    const header = buildHeader({
      ts: 'Recording timestampX [ms]',
      fx: FORMS.bare.fx,
      fy: FORMS.bare.fy,
    })
    // Build rows with cell[0] = ts, but the adapter shouldn't recognise that
    // column as the timestamp → every row rejected at the !isFinite(ts) gate.
    const outputs = runAdapter(header, buildRows(header))
    expect(outputs.length).toBe(0)
  })
})
