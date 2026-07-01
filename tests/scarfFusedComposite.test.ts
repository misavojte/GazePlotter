import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
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

  const reader = createReaderFromJson([[], perP])
  const aoiData: (string[] | null)[] = [
    null,
    ['AOI 1', 'AOI 1', '#e41a1c'],
    ['AOI 2', 'AOI 2', '#377eb8'],
    ['AOI 3', 'AOI 3', '#4daf4a'],
    ['AOI 4', 'AOI 4', '#984ea3'],
  ]
  const metadata = {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    aois: {
      data: [[], aoiData],
      orderVector: [[], [1, 2, 3, 4]],
      hiddenAois: [[], []],
    },
    categories: {
      data: [
        ['Fixation', 'Fixation', '#000000'],
        ['Saccade', 'Saccade', '#cccccc'],
      ],
      orderVector: [],
    },
    participants: {
      data: [['P0', 'P0'], ['P1', 'P1'], ['P2', 'P2']],
      orderVector: [],
    },
    participantsGroups: [],
    stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
    noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    metricInstances: [],
  }
  const agr = new AoiGroupReader(reader)
  agr.updateMap(metadata as never)
  return {
    metadata,
    capabilities: { segmented: true, spatial: false, event: false },
    eventsPerStimulus: [],
    getReader: () => reader,
    getAoiGroupReader: () => agr,
    getAoiMapping: (s: number, r: number) => agr.getAoiMapping(s, r),
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
    const nonFixationHeight = SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT
    const invBarH = 1 / SCARF_LAYOUT.HEIGHT_BAR_DEFAULT

    const styleCount =
      data.stylingAndLegend.aoi.length +
      data.stylingAndLegend.category.length +
      data.stylingAndLegend.visibility.length
    const styleRgb = new Float32Array(styleCount * 3)
    for (let s = 0; s < styleCount; s++) {
      styleRgb[s * 3] = 60 + s * 18
      styleRgb[s * 3 + 1] = 110
      styleRgb[s * 3 + 2] = 150
    }

    const acc = new Float32Array(rows * pWidth * 4)
    const r = compositeGazeBinaryAcc(
      acc,
      data.gazeSource,
      styleRgb,
      pWidth,
      rows,
      invBarH,
      nonFixationHeight,
      scaleFactor
    )

    // Invariants: 0 ≤ alpha ≤ 1, every covered cell's un-premultiplied colour in
    // [0,255], no NaN. A blend/geometry bug breaks one of these.
    let coveredCells = 0
    let totalAlpha = 0
    for (let k = 0; k < acc.length; k += 4) {
      const a = acc[k + 3]
      expect(Number.isFinite(a)).toBe(true)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(1 + 1e-6)
      if (a > 0.01) {
        coveredCells++
        totalAlpha += a
        const ia = 1 / a
        for (let c = 0; c < 3; c++) {
          const v = acc[k + c] * ia
          expect(v).toBeGreaterThanOrEqual(-0.5)
          expect(v).toBeLessThanOrEqual(255.5)
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
const SNAPSHOT = { subPixelCount: 5363, coveredCells: 1795, totalAlpha: 947.709 }
