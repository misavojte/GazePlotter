import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import { getScarfData } from '../src/lib/plots/scarf/core/view'
import { compositeGazeBinaryAcc } from '../src/lib/plots/scarf/core/renderer'
import { SCARF_LAYOUT } from '../src/lib/plots/scarf/const'
import type { ScarfPlotSettings } from '../src/lib/plots/scarf/types'

// Regression guard for the single-pass gaze composite (straight from the binary
// segment store, no rect buckets). Composites a deterministic wide dataset (many
// sub-pixel segments, mix of 1-AOI / 2-AOI / no-AOI fixations and saccades — every
// style-resolution branch) into the accumulator and asserts:
//  - the premultiplied "over" invariants hold everywhere (0 ≤ alpha ≤ 1, every
//    un-premultiplied channel in [0,255], no NaN) — catches a blend/geometry bug;
//  - the sub-pixel count + covered-cell count + total coverage match a SNAPSHOT —
//    catches any drift in the projection / AOI resolution / height split (a
//    dropped or extra segment changes these deterministic totals).

function buildEngine() {
  // Seeded LCG so the fixture is deterministic across runs.
  let seed = 987654321
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const PARTICIPANTS = 3
  const SEGS = 1500
  const perP: number[][][] = []
  for (let p = 0; p < PARTICIPANTS; p++) {
    const segs: number[][] = []
    let t = 0
    for (let k = 0; k < SEGS; k++) {
      const dur = 3 + ((rnd() * 4) | 0) // 3-6 ms -> sub-pixel over the full extent
      const start = t
      const end = t + dur
      t = end + 1 + ((rnd() * 2) | 0)
      const roll = rnd()
      const a = 1 + ((rnd() * 4) | 0) // AOI id 1..4
      if (roll < 0.15) {
        segs.push([start, end, 1]) // saccade (non-fixation)
      } else if (roll < 0.25) {
        segs.push([start, end, FIXATION_CATEGORY_ID]) // fixation, no AOI
      } else if (roll < 0.45) {
        const b = (a % 4) + 1 // distinct second AOI -> genuine 2-AOI overlap
        segs.push([start, end, FIXATION_CATEGORY_ID, a, b])
      } else {
        segs.push([start, end, FIXATION_CATEGORY_ID, a]) // 1-AOI fixation
      }
    }
    perP.push(segs)
  }

  const aoiData: (string[] | null)[] = [
    null,
    ['AOI 1', 'AOI 1', '#e41a1c'],
    ['AOI 2', 'AOI 2', '#377eb8'],
    ['AOI 3', 'AOI 3', '#4daf4a'],
    ['AOI 4', 'AOI 4', '#984ea3'],
  ]
  return {
    ...makeTestEngine([[], perP], {
      aoiData: [[], aoiData],
      aoiOrderVector: [[], [1, 2, 3, 4]],
      categories: [
        ['Fixation', 'Fixation', '#000000'],
        ['Saccade', 'Saccade', '#cccccc'],
      ],
      aoiMapping: 'group',
    }),
    capabilities: { segmented: true, spatial: false, event: false },
    eventsPerStimulus: [],
  } as never
}

const SETTINGS: ScarfPlotSettings = {
  stimulusId: 1,
  groupId: -1,
  timeline: 'absolute',
  absoluteStimuliLimits: [],
  ordinalStimuliLimits: [],
  timelineStart: 0,
  timelineEnd: 0,
}

describe('gaze binary composite (single pass, no buckets)', () => {
  it('holds the over-blend invariants and matches the coverage snapshot', () => {
    const engine = buildEngine()
    const data = getScarfData(engine, SETTINGS)!
    expect(data.gazeSource).toBeTruthy()

    const rows = data.participants.length
    const pWidth = 600
    const scaleFactor = 1
    const invBarH = 1 / SCARF_LAYOUT.HEIGHT_BAR_DEFAULT

    const styleCount =
      data.stylingAndLegend.aoi.length +
      data.stylingAndLegend.category.length +
      data.stylingAndLegend.event.length
    const styleRgb = new Float32Array(styleCount * 3)
    for (let s = 0; s < styleCount; s++) {
      styleRgb[s * 3] = 60 + s * 18
      styleRgb[s * 3 + 1] = 110
      styleRgb[s * 3 + 2] = 150
    }

    const acc = new Float32Array(rows * pWidth * 4)
    const accThin = new Float32Array(rows * pWidth * 4)
    const r = compositeGazeBinaryAcc(
      acc,
      accThin,
      data.gazeSource,
      styleRgb,
      pWidth,
      rows,
      invBarH,
      scaleFactor
    )

    // Invariants over BOTH lanes: 0 ≤ alpha ≤ 1, every covered cell's
    // un-premultiplied colour in [0,255], no NaN. A blend/geometry bug breaks one.
    let coveredCells = 0
    let totalAlpha = 0
    for (const lane of [acc, accThin]) {
      for (let k = 0; k < lane.length; k += 4) {
        const a = lane[k + 3]
        expect(Number.isFinite(a)).toBe(true)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(1 + 1e-6)
        if (a > 0.01) {
          coveredCells++
          totalAlpha += a
          const ia = 1 / a
          for (let c = 0; c < 3; c++) {
            const v = lane[k + c] * ia
            expect(v).toBeGreaterThanOrEqual(-0.5)
            expect(v).toBeLessThanOrEqual(255.5)
          }
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[gaze-binary-composite] subPixel=${r.subPixelCount} coveredCells=${coveredCells} totalAlpha=${totalAlpha.toFixed(3)}`
    )

    // The accumulator did real work (sub-pixel accumulate, not just pass-3).
    expect(r.subPixelCount).toBeGreaterThan(1000)
    expect(coveredCells).toBeGreaterThan(0)

    // Deterministic snapshot (seeded fixture): a drop/extra segment or a change in
    // projection / AOI resolution / height split shifts these. Update ONLY with a
    // deliberate behaviour change.
    expect(r.subPixelCount).toBe(SNAPSHOT.subPixelCount)
    expect(coveredCells).toBe(SNAPSHOT.coveredCells)
    expect(totalAlpha).toBeCloseTo(SNAPSHOT.totalAlpha, 1)
  })
})

// Pinned from a run (see the [gaze-binary-composite] log line). A change here means
// the gaze geometry/resolution changed — update only deliberately.
// 2026-07-23: re-pinned for the thin-lane split (non-fixation sub-pixel energy
// moved to `accThin` at full in-band alpha; subPixelCount unchanged proves no
// segment was dropped).
const SNAPSHOT = { subPixelCount: 5363, coveredCells: 2557, totalAlpha: 1117.895 }

// Regression: a dense run of ADJACENT sub-pixel non-fixations (e.g. a
// lost-tracking tail alternating EyesNotFound/Unclassified every ~3ms) tiles
// its pixel columns. With one accumulator lane this composited into a
// translucent FULL-bar-height band while the same types' >=1px segments drew
// correct thin lines beside it. The split lanes route ALL non-fixation
// sub-pixel energy to the thin band.
describe('sub-pixel non-fixations stay in the thin lane', () => {
  it('a tiling alternation produces zero full-lane energy and full thin-lane coverage', () => {
    // 300 adjacent 3ms segments alternating two non-fixation types over
    // 0-900ms, then one wide fixation to 10000ms so the alternation is
    // sub-pixel at pWidth 600 (3ms -> 0.18px).
    const segs: number[][] = []
    for (let k = 0; k < 300; k++) {
      segs.push([k * 3, (k + 1) * 3, 1 + (k % 2)])
    }
    segs.push([900, 10000, FIXATION_CATEGORY_ID, 1])
    const engine = {
      ...makeTestEngine([[], [[...segs]]], {
        aoiData: [[], [null, ['A1', 'A1', '#e41a1c']]],
        aoiOrderVector: [[], [1]],
        categories: [
          ['Fixation', 'Fixation', '#000000'],
          ['EyesNotFound', 'EyesNotFound', '#737373'],
          ['Unclassified', 'Unclassified', '#9c9c9c'],
        ],
        aoiMapping: 'group',
      }),
      capabilities: { segmented: true, spatial: false, event: false },
      eventsPerStimulus: [],
    } as never
    const data = getScarfData(engine, SETTINGS)!
    const pWidth = 600
    const styleCount =
      data.stylingAndLegend.aoi.length + data.stylingAndLegend.category.length
    const acc = new Float32Array(pWidth * 4)
    const accThin = new Float32Array(pWidth * 4)
    const styleRgb = new Float32Array(styleCount * 3).fill(120)
    const r = compositeGazeBinaryAcc(
      acc, accThin, data.gazeSource, styleRgb,
      pWidth, 1, 1 / SCARF_LAYOUT.HEIGHT_BAR_DEFAULT, 1
    )
    expect(r.subPixelCount).toBe(300)

    // The alternation spans x = 0 .. 900/10000*600 = 54px. Full lane: NOTHING
    // (no fixation is sub-pixel); thin lane: every tiled column solidly
    // covered ("over"-blended abutting fragments converge below 1, the
    // documented downsample tolerance — the pin is the LANE, not the exact
    // alpha).
    const alternationCols = Math.floor((900 / 10000) * pWidth)
    for (let px = 0; px < alternationCols - 1; px++) {
      expect(acc[px * 4 + 3]).toBe(0)
      expect(accThin[px * 4 + 3]).toBeGreaterThan(0.5)
    }
  })
})

// The thin/slice discriminator is the explicit `thin` flag, never the rect
// height: with HEIGHT_BAR_DEFAULT divisible so that HEIGHT_BAR_DEFAULT /
// resolvedAoiCount === HEIGHT_NON_FIXATION_DEFAULT, a value comparison would
// misplace every such fixation slice onto the centred non-fixation line. The
// current constants (15, 4) happen to make that unreachable; the flag keeps
// placement correct under ANY constants.
describe('wide-rect thin flag', () => {
  function buildCollisionEngine() {
    const segs = [
      [0, 100, FIXATION_CATEGORY_ID, 1, 2, 3, 4, 5], // fixation over ALL 5 AOIs
      [110, 210, 1], // type 1 (saccade)
      [220, 320, 2], // type 2
      [330, 430, 3], // type 3
      [440, 600, FIXATION_CATEGORY_ID, 1], // 1-AOI fixation for contrast
    ]
    const aoiData: (string[] | null)[] = [
      null,
      ['A1', 'A1', '#e41a1c'],
      ['A2', 'A2', '#377eb8'],
      ['A3', 'A3', '#4daf4a'],
      ['A4', 'A4', '#984ea3'],
      ['A5', 'A5', '#ff7f00'],
    ]
    return {
      ...makeTestEngine([[], [segs]], {
        aoiData: [[], aoiData],
        aoiOrderVector: [[], [1, 2, 3, 4, 5]],
        categories: [
          ['Fixation', 'Fixation', '#000000'],
          ['Saccade', 'Saccade', '#cccccc'],
          ['Blink', 'Blink', '#999999'],
          ['Unclassified', 'Unclassified', '#666666'],
        ],
        aoiMapping: 'group',
      }),
      capabilities: { segmented: true, spatial: false, event: false },
      eventsPerStimulus: [],
    } as never
  }

  it('marks every non-fixation type thin and every fixation slice non-thin', () => {
    const engine = buildCollisionEngine()
    const data = getScarfData(engine, SETTINGS)!
    const pWidth = 600
    const styleCount =
      data.stylingAndLegend.aoi.length + data.stylingAndLegend.category.length
    const acc = new Float32Array(1 * pWidth * 4)
    const wide: Array<{
      x0px: number
      wPx: number
      pIdx: number
      hOrig: number
      internalY: number
      styleIdx: number
      thin: boolean
    }> = []
    compositeGazeBinaryAcc(
      acc, new Float32Array(1 * pWidth * 4), data.gazeSource,
      new Float32Array(styleCount * 3),
      pWidth, 1, 1 / SCARF_LAYOUT.HEIGHT_BAR_DEFAULT, 1, wide
    )

    // One rect per type, all thin, all at the shared non-fixation height.
    const thinRects = wide.filter(w => w.thin)
    expect(thinRects.map(w => w.styleIdx).sort()).toHaveLength(3)
    expect(new Set(thinRects.map(w => w.styleIdx)).size).toBe(3)
    for (const w of thinRects) {
      expect(w.hOrig).toBe(SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT)
    }

    // The 5-AOI fixation: five stacked non-thin slices with distinct y offsets.
    const slices = wide.filter(
      w => !w.thin && w.hOrig === SCARF_LAYOUT.HEIGHT_BAR_DEFAULT / 5
    )
    expect(slices).toHaveLength(5)
    expect(new Set(slices.map(w => w.internalY)).size).toBe(5)
  })
})
