/**
 * Regression test: Tobii exports with per-stimulus `Mapped eye movement type [<X>]`
 * columns must emit segments for every stimulus that appears in the interval stack,
 * not just the first mapped column.
 *
 * @see $lib/data/ingest/formats/lib/rows/TobiiRowParser.ts
 */
import { describe, it, expect } from 'vitest'
import { TobiiRowParser } from '$lib/data/ingest/formats/lib/rows/TobiiRowParser'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

// Header layout mirrors the Advolution-style export: four mapped category /
// fixation columns, only the active stimulus's column carries data.
const HEADER = [
  'Recording timestamp',
  'Sensor',
  'Participant name',
  'Recording name',
  'Event',
  'Mapped eye movement type [02-walk]',
  'Mapped eye movement type [01-walk]',
  'Mapped eye movement type [03-ride]',
  'Mapped eye movement type [04-ride]',
  'Mapped eye movement type index [02-walk]',
  'Mapped eye movement type index [01-walk]',
  'Mapped eye movement type index [03-ride]',
  'Mapped eye movement type index [04-ride]',
  'Mapped fixation X [02-walk]',
  'Mapped fixation Y [02-walk]',
  'Mapped fixation X [01-walk]',
  'Mapped fixation Y [01-walk]',
  'Mapped fixation X [03-ride]',
  'Mapped fixation Y [03-ride]',
  'Mapped fixation X [04-ride]',
  'Mapped fixation Y [04-ride]',
  'Eye movement type',
  'Eye movement type index',
  'Fixation point X',
  'Fixation point Y',
  'AOI hit [01-walk - a]',
  'AOI hit [02-walk - a]',
  'AOI hit [03-ride - a]',
  'AOI hit [04-ride - a]',
]

const STIMS = ['01-walk', '02-walk', '03-ride', '04-ride'] as const

const COL_CATEGORY: Record<(typeof STIMS)[number], number> = {
  '01-walk': HEADER.indexOf('Mapped eye movement type [01-walk]'),
  '02-walk': HEADER.indexOf('Mapped eye movement type [02-walk]'),
  '03-ride': HEADER.indexOf('Mapped eye movement type [03-ride]'),
  '04-ride': HEADER.indexOf('Mapped eye movement type [04-ride]'),
}
const COL_CATEGORY_INDEX: Record<(typeof STIMS)[number], number> = {
  '01-walk': HEADER.indexOf('Mapped eye movement type index [01-walk]'),
  '02-walk': HEADER.indexOf('Mapped eye movement type index [02-walk]'),
  '03-ride': HEADER.indexOf('Mapped eye movement type index [03-ride]'),
  '04-ride': HEADER.indexOf('Mapped eye movement type index [04-ride]'),
}
const COL_FIX_X: Record<(typeof STIMS)[number], number> = {
  '01-walk': HEADER.indexOf('Mapped fixation X [01-walk]'),
  '02-walk': HEADER.indexOf('Mapped fixation X [02-walk]'),
  '03-ride': HEADER.indexOf('Mapped fixation X [03-ride]'),
  '04-ride': HEADER.indexOf('Mapped fixation X [04-ride]'),
}
const COL_FIX_Y: Record<(typeof STIMS)[number], number> = {
  '01-walk': HEADER.indexOf('Mapped fixation Y [01-walk]'),
  '02-walk': HEADER.indexOf('Mapped fixation Y [02-walk]'),
  '03-ride': HEADER.indexOf('Mapped fixation Y [03-ride]'),
  '04-ride': HEADER.indexOf('Mapped fixation Y [04-ride]'),
}

function rowFor(opts: {
  ts: number
  sensor: string
  event?: string
  stim?: (typeof STIMS)[number]
  cat?: 'Fixation' | 'EyesNotFoundMovement'
  catIdx?: number
  fixX?: number
  fixY?: number
}): string {
  const cells: string[] = new Array(HEADER.length).fill('')
  cells[0] = String(opts.ts)
  cells[1] = opts.sensor
  cells[2] = 'P1'
  cells[3] = 'R1'
  cells[4] = opts.event ?? ''

  if (opts.stim && opts.cat) {
    cells[COL_CATEGORY[opts.stim]] = opts.cat
    cells[COL_CATEGORY_INDEX[opts.stim]] = String(opts.catIdx ?? 1)
    if (opts.fixX !== undefined) cells[COL_FIX_X[opts.stim]] = String(opts.fixX)
    if (opts.fixY !== undefined) cells[COL_FIX_Y[opts.stim]] = String(opts.fixY)
  }

  // Generic fallbacks
  cells[HEADER.indexOf('Eye movement type')] = 'Fixation'
  cells[HEADER.indexOf('Eye movement type index')] = '1'
  cells[HEADER.indexOf('Fixation point X')] = '500'
  cells[HEADER.indexOf('Fixation point Y')] = '500'

  return cells.join('\t')
}

// Header used by the media-mode test: a single media stimulus name plus the
// per-stimulus mapped category columns that media mode must NOT read.
const MEDIA_HEADER = [
  'Recording timestamp',
  'Sensor',
  'Participant name',
  'Recording name',
  'Recording media name',
  'Mapped eye movement type [02-walk]',
  'Mapped eye movement type [01-walk]',
  'Eye movement type',
  'Eye movement type index',
  'Fixation point X',
  'Fixation point Y',
]

describe('TobiiRowParser — multi-stimulus mapped columns', () => {
  it('emits segments for every stimulus in interleaved IntervalStart/End blocks', () => {
    const rows: string[] = []
    let ts = 1_000_000
    const STEP = 5_000 // 5 ms in µs

    for (const stim of STIMS) {
      // IntervalStart marker row (no Sensor)
      rows.push(rowFor({ ts, sensor: '', event: `${stim} IntervalStart` }))
      ts += STEP
      // A few Eye Tracker samples while the interval is active
      for (let k = 0; k < 5; k++) {
        rows.push(
          rowFor({
            ts,
            sensor: 'Eye Tracker',
            stim,
            cat: 'Fixation',
            catIdx: 1,
            fixX: 100 + k,
            fixY: 200 + k,
          })
        )
        ts += STEP
      }
      // IntervalEnd marker row
      rows.push(rowFor({ ts, sensor: '', event: `${stim} IntervalEnd` }))
      ts += STEP
      // A gap (no active stimulus)
      ts += 50_000
    }

    const adapter = new TobiiRowParser(
      HEADER,
      '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(adapter)
    processRows(rows, { finalize: true })

    const stimuli = new Set(outputs.map(o => o.stimulus))
    expect(stimuli).toEqual(new Set(STIMS))
    // At least one segment per stimulus
    for (const s of STIMS) {
      expect(outputs.some(o => o.stimulus === s)).toBe(true)
    }
  })

  it('media-name parsing reads only unmapped Eye movement type / Fixation point', () => {
    const idxTs = MEDIA_HEADER.indexOf('Recording timestamp')
    const idxSensor = MEDIA_HEADER.indexOf('Sensor')
    const idxParticipant = MEDIA_HEADER.indexOf('Participant name')
    const idxRecording = MEDIA_HEADER.indexOf('Recording name')
    const idxMedia = MEDIA_HEADER.indexOf('Recording media name')
    const idxMapped02 = MEDIA_HEADER.indexOf(
      'Mapped eye movement type [02-walk]'
    )
    const idxEMT = MEDIA_HEADER.indexOf('Eye movement type')
    const idxEMTIdx = MEDIA_HEADER.indexOf('Eye movement type index')
    const idxFX = MEDIA_HEADER.indexOf('Fixation point X')
    const idxFY = MEDIA_HEADER.indexOf('Fixation point Y')

    function row(opts: {
      ts: number
      mapped02?: string // value placed in the per-stimulus mapped column
      emt?: string
      emtIdx?: string
      fx?: number
      fy?: number
    }): string {
      const cells = new Array(MEDIA_HEADER.length).fill('')
      cells[idxTs] = String(opts.ts)
      cells[idxSensor] = 'Eye Tracker'
      cells[idxParticipant] = 'P1'
      cells[idxRecording] = 'R1'
      cells[idxMedia] = 'scenevideo.mp4'
      if (opts.mapped02) cells[idxMapped02] = opts.mapped02
      if (opts.emt) cells[idxEMT] = opts.emt
      if (opts.emtIdx) cells[idxEMTIdx] = opts.emtIdx
      if (opts.fx !== undefined) cells[idxFX] = String(opts.fx)
      if (opts.fy !== undefined) cells[idxFY] = String(opts.fy)
      return cells.join('\t')
    }

    // The mapped column carries garbage; if media mode reads it, the test
    // would pick up bogus segments. Media mode must read only Eye movement
    // type / Fixation point X/Y.
    const rows = [
      row({
        ts: 1_000_000,
        mapped02: 'GARBAGE',
        emt: 'Fixation',
        emtIdx: '1',
        fx: 100,
        fy: 200,
      }),
      row({
        ts: 1_005_000,
        mapped02: 'GARBAGE',
        emt: 'Fixation',
        emtIdx: '1',
        fx: 100,
        fy: 200,
      }),
      row({
        ts: 1_010_000,
        mapped02: 'GARBAGE',
        emt: 'Fixation',
        emtIdx: '1',
        fx: 100,
        fy: 200,
      }),
    ]

    const adapter = new TobiiRowParser(MEDIA_HEADER, '', '\t')
    const { outputs, processRows } = createAdapterHarness(adapter)
    processRows(rows, { finalize: true })

    expect(outputs.length).toBeGreaterThan(0)
    // categoryId 0 == Fixation (per TobiiRowParser.getCategoryId)
    expect(outputs.every(o => o.categoryId === 0)).toBe(true)
    expect(outputs.every(o => o.stimulus === 'scenevideo.mp4')).toBe(true)
    // Spatial coords must come from Fixation point X/Y, not the mapped col
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
  })
})
