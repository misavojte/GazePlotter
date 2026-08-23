/**
 * Regression test: Tobii exports with per-stimulus `Mapped eye movement type [<X>]`
 * columns must emit segments for every stimulus that appears in the interval stack,
 * not just the first mapped column.
 *
 * @see $lib/data/ingest/formats/lib/rows/TobiiRowParser.ts
 */
import { describe, it, expect } from 'vitest'
import {
  TOBII_HEADER,
  tobiiRow,
  runTobiiParser,
} from './helpers/ingestAdapterHarness'

const STIMS = ['01-walk', '02-walk', '03-ride', '04-ride'] as const

// Header layout mirrors the Advolution-style export: four mapped category /
// fixation columns, only the active stimulus's column carries data.
const HEADER = [
  ...TOBII_HEADER.slice(0, 5), // through Event
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
  ...TOBII_HEADER.slice(5), // Eye movement type + index
  'Fixation point X',
  'Fixation point Y',
  'AOI hit [01-walk - a]',
  'AOI hit [02-walk - a]',
  'AOI hit [03-ride - a]',
  'AOI hit [04-ride - a]',
]

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
  // Generic fallbacks on every row; the parser must prefer the mapped columns.
  const cells: Record<string, string> = {
    Sensor: opts.sensor,
    'Eye movement type': 'Fixation',
    'Eye movement type index': '1',
    'Fixation point X': '500',
    'Fixation point Y': '500',
  }
  if (opts.stim && opts.cat) {
    cells[`Mapped eye movement type [${opts.stim}]`] = opts.cat
    cells[`Mapped eye movement type index [${opts.stim}]`] = String(
      opts.catIdx ?? 1
    )
    if (opts.fixX !== undefined)
      cells[`Mapped fixation X [${opts.stim}]`] = String(opts.fixX)
    if (opts.fixY !== undefined)
      cells[`Mapped fixation Y [${opts.stim}]`] = String(opts.fixY)
  }
  return tobiiRow({ ts: opts.ts, event: opts.event, cells }, HEADER)
}

// Header used by the media-mode test: a single media stimulus name plus the
// per-stimulus mapped category columns that media mode must NOT read.
const MEDIA_HEADER = [
  ...TOBII_HEADER.slice(0, 4),
  'Recording media name',
  'Mapped eye movement type [02-walk]',
  'Mapped eye movement type [01-walk]',
  ...TOBII_HEADER.slice(5), // Eye movement type + index, no Event column
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

    const { outputs } = runTobiiParser(
      rows,
      '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}',
      HEADER
    )

    const stimuli = new Set(outputs.map(o => o.stimulus))
    expect(stimuli).toEqual(new Set(STIMS))
    // At least one segment per stimulus
    for (const s of STIMS) {
      expect(outputs.some(o => o.stimulus === s)).toBe(true)
    }
  })

  it('media-name parsing reads only unmapped Eye movement type / Fixation point', () => {
    function row(opts: {
      ts: number
      mapped02?: string // value placed in the per-stimulus mapped column
      emt?: string
      emtIdx?: string
      fx?: number
      fy?: number
    }): string {
      const cells: Record<string, string> = {
        Sensor: 'Eye Tracker',
        'Recording media name': 'scenevideo.mp4',
      }
      if (opts.mapped02)
        cells['Mapped eye movement type [02-walk]'] = opts.mapped02
      if (opts.emt) cells['Eye movement type'] = opts.emt
      if (opts.emtIdx) cells['Eye movement type index'] = opts.emtIdx
      if (opts.fx !== undefined) cells['Fixation point X'] = String(opts.fx)
      if (opts.fy !== undefined) cells['Fixation point Y'] = String(opts.fy)
      return tobiiRow({ ts: opts.ts, cells }, MEDIA_HEADER)
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

    const { outputs } = runTobiiParser(rows, '', MEDIA_HEADER)

    expect(outputs.length).toBeGreaterThan(0)
    // categoryId 0 == Fixation (per TobiiRowParser.getCategoryId)
    expect(outputs.every(o => o.categoryId === 0)).toBe(true)
    expect(outputs.every(o => o.stimulus === 'scenevideo.mp4')).toBe(true)
    // Spatial coords must come from Fixation point X/Y, not the mapped col
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
  })
})
