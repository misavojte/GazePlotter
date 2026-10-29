import { describe, it, expect, vi } from 'vitest'
import { ALL_CAPS, makeTestEngine, testInstance } from './helpers/testEngine'
import { query } from '../src/lib/metrics'
import {
  SIGMA_PER_RADIUS,
  blurGaussian,
  bucketFixations,
  fixationsWithin,
  gridFor,
  isCoarseGrid,
  kernelTaps,
  splatFixations,
} from '../src/lib/plots/fixation-heatmap/core/density'
import { autoRadius, getFixationHeatmapData } from '../src/lib/plots/fixation-heatmap/core/transformer'
import { fadeIn, heatLut, legendRamp, maskLut, paintHeat } from '../src/lib/plots/fixation-heatmap/core/heatImage'
import {
  deriveFixationHeatmapView,
  formatAmount,
  heatmapLegendTitle,
  heatmapNotes,
  niceCeil,
} from '../src/lib/plots/fixation-heatmap/core/view'
import { fixationHeatmapDefinition } from '../src/lib/plots/fixation-heatmap/definition'
import type {
  FixationHeatmapData,
  FixationHeatmapPlotSettings,
  FixationHeatmapTransformResult,
} from '../src/lib/plots/fixation-heatmap/types'
import type { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'
import type { StimulusMedia } from '../src/lib/data/types'

/** [start, end, x, y]; NaN x = a fixation without coordinates. */
type Fix = [number, number, number, number]

function engineOf(stimuli: Fix[][][], extra: Parameters<typeof makeTestEngine>[1] = {}): DataEngine {
  return makeTestEngine(
    stimuli.map(ps => ps.map(fs => fs.map(([s, e]) => [s, e, 0]))),
    {
      capabilities: ALL_CAPS,
      spatial: stimuli.map(ps => ps.map(fs => fs.map(([, , x, y]) => (Number.isNaN(x) ? null : [x, y])))),
      ...extra,
    }
  )
}

const settings = (over: Partial<FixationHeatmapPlotSettings> = {}): FixationHeatmapPlotSettings => ({
  stimulusId: 1,
  accumulate: 'duration',
  normalization: 'share',
  radius: 30,
  view: 'heatmap',
  colorScale: ['#ffeda0', '#fd8d3c', '#bd0026'],
  scaleMax: 0,
  opacity: 70,
  maskColor: '#000000',
  maskOpacity: 90,
  showFixations: false,
  background: 'image',
  ...over,
})

function ok(result: FixationHeatmapTransformResult): FixationHeatmapData {
  if (result.kind !== 'ok') throw new Error(`unavailable: ${result.reason}`)
  return result.data
}

/** Reference kernel: the continuous tapered Gaussian that `kernelTaps` samples. */
function kernelAt(dx: number, dy: number, radius: number): number {
  const sigma = radius * SIGMA_PER_RADIUS
  const floor = Math.exp(-4.5)
  const g = (d: number) =>
    Math.abs(d) >= radius ? 0 : (Math.exp(-(d * d) / (2 * sigma * sigma)) - floor) / (1 - floor)
  return g(dx) * g(dy)
}

/** Deterministic pseudo-random sequence (tests must not flake). */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

// Two participants on stimulus 1 inside a 0..400 x 0..300 field.
const P0: Fix[] = [
  [0, 300, 100, 100],
  [300, 500, 110, 105],
  [500, 1500, 300, 200],
]
const P1: Fix[] = [
  [0, 200, 120, 90],
  [200, 900, 290, 210],
  [900, 1000, NaN, NaN],
]

describe('density kernel', () => {
  const extent = { x: 0, y: 0, width: 100, height: 100 }
  const R = 30

  function mapOf(points: [number, number, number][]) {
    const grid = gridFor(extent, R)
    const values = new Float32Array(grid.cols * grid.rows)
    const xs = Float32Array.from(points.map(p => p[0]))
    const ys = Float32Array.from(points.map(p => p[1]))
    const ws = Float32Array.from(points.map(p => p[2]))
    splatFixations(xs, ys, ws, points.length, grid, values)
    return { grid, values }
  }

  it('peaks at the weight on a cell centre and at least 0.97 w between cells', () => {
    const { grid } = mapOf([])
    const centre = grid.x0 + 32.5 * grid.cell
    const onCentre = mapOf([[centre, centre, 100]])
    blurGaussian(onCentre.values, onCentre.grid, kernelTaps(R, grid.cell), new Float32Array(onCentre.values.length))
    expect(Math.max(...onCentre.values)).toBeCloseTo(100, 3)
    const corner = grid.x0 + 32 * grid.cell
    const between = mapOf([[corner, corner, 100]])
    blurGaussian(between.values, between.grid, kernelTaps(R, grid.cell), new Float32Array(between.values.length))
    expect(Math.max(...between.values)).toBeGreaterThanOrEqual(97)
  })

  it('is zero from R on along each axis, and at most 1 % at radius R on the diagonal', () => {
    expect(kernelAt(R, 0, R)).toBe(0)
    expect(kernelAt(0, -R, R)).toBe(0)
    expect(kernelAt(R + 1, R + 1, R)).toBe(0)
    expect(kernelAt(0, 0, R)).toBe(1)
    expect(kernelAt(R / Math.SQRT2, R / Math.SQRT2, R)).toBeLessThanOrEqual(0.01)
    const taps = kernelTaps(R, 2.5)
    expect(taps[taps.length - 1]).toBe(0)
  })

  it('splatting conserves mass', () => {
    const next = rng(1)
    const points: [number, number, number][] = Array.from({ length: 50 }, () => [next() * 100, next() * 100, 1 + next() * 9])
    const { values } = mapOf(points)
    const mass = points.reduce((a, p) => a + p[2], 0)
    expect(values.reduce((a, v) => a + v, 0)).toBeCloseTo(mass, 2)
  })

  it('matches the continuous kernel at the true fixation positions within 3.5 % of the peak', () => {
    const next = rng(7)
    const points: [number, number, number][] = Array.from({ length: 20 }, () => [next() * 100, next() * 100, 50 + next() * 200])
    const { grid, values } = mapOf(points)
    blurGaussian(values, grid, kernelTaps(R, grid.cell), new Float32Array(values.length))
    let peak = 0
    let worst = 0
    for (let j = 0; j < grid.rows; j++) {
      for (let i = 0; i < grid.cols; i++) {
        const cx = grid.x0 + (i + 0.5) * grid.cell
        const cy = grid.y0 + (j + 0.5) * grid.cell
        let exact = 0
        for (const [x, y, w] of points) exact += w * kernelAt(cx - x, cy - y, R)
        peak = Math.max(peak, exact)
        worst = Math.max(worst, Math.abs(values[j * grid.cols + i] - exact))
      }
    }
    expect(worst / peak).toBeLessThan(0.035)
  })

  it('bounds the bucket table for a tiny radius and still answers exactly', () => {
    const next = rng(11)
    const n = 200
    const xs = Float32Array.from({ length: n }, () => next() * 2000)
    const ys = Float32Array.from({ length: n }, () => next() * 1000)
    const grid = gridFor({ x: 0, y: 0, width: 2000, height: 1000 }, 0.01)
    const buckets = bucketFixations(xs, ys, n, grid, 0.01)
    // Per-axis rounding may add an edge row or column; the table stays near 1M entries.
    expect(buckets.offsets.length).toBeLessThan(1.1 * (1 << 20))
    const out = new Uint32Array(n)
    expect(fixationsWithin(buckets, xs, ys, xs[7], ys[7], 0.01, out)).toBeGreaterThanOrEqual(1)
    expect(Array.from(out.subarray(0, fixationsWithin(buckets, xs, ys, xs[7], ys[7], 0.01, out)))).toContain(7)
  })

  it('the bucketed radius query equals brute force', () => {
    const next = rng(3)
    const n = 400
    const xs = Float32Array.from({ length: n }, () => next() * 160 - 30)
    const ys = Float32Array.from({ length: n }, () => next() * 160 - 30)
    const grid = gridFor(extent, R)
    const buckets = bucketFixations(xs, ys, n, grid, R)
    const out = new Uint32Array(n)
    for (let q = 0; q < 40; q++) {
      const px = next() * 100
      const py = next() * 100
      const got = Array.from(out.subarray(0, fixationsWithin(buckets, xs, ys, px, py, R, out))).sort((a, b) => a - b)
      const want: number[] = []
      for (let k = 0; k < n; k++) if ((xs[k] - px) ** 2 + (ys[k] - py) ** 2 <= R * R) want.push(k)
      expect(got).toEqual(want)
    }
  })
})

describe('getFixationHeatmapData', () => {
  const engine = () => engineOf([[], [P0, P1]])

  it('reconciles its mass with the metric library: clipped dwell and midpoint count', () => {
    const inst = (baseId: string) => testInstance(baseId, { kind: 'identity-aoi-vector' }, { id: baseId })
    const anyFixation = (baseId: string, timeStart: number, timeEnd: number) => {
      const r = query(inst(baseId), { engine: engine(), stimulusId: 1, participantId: 0, timeStart, timeEnd })
      return (r as { values: number[] }).values.at(-1)!
    }
    for (const [timeStart, timeEnd] of [[0, 0], [400, 1200], [400, 0]]) {
      for (const accumulate of ['duration', 'count'] as const) {
        const data = ok(
          getFixationHeatmapData(engine(), settings({ accumulate, timelineStart: timeStart, timelineEnd: timeEnd }))
        )
        let mass = 0
        for (let k = 0; k < data.xs.length; k++) if (data.participants[data.participantIndex[k]].id === 0) mass += data.raw[k]
        const metric = anyFixation(accumulate === 'duration' ? 'absoluteTime' : 'fixationCount', timeStart, timeEnd)
        expect(mass, `${accumulate} ${timeStart}-${timeEnd}`).toBeCloseTo(metric, 6)
      }
    }
  })

  it('share mode gives each participant equal weight: scaling one person changes nothing', () => {
    const slow = engineOf([[], [P0, P1.map(([s, e, x, y]) => [s * 3, e * 3, x, y] as Fix)]])
    const a = ok(getFixationHeatmapData(engine(), settings()))
    const b = ok(getFixationHeatmapData(slow, settings()))
    for (let k = 0; k < a.values.length; k++) expect(b.values[k]).toBeCloseTo(a.values[k], 3)
    const meanA = ok(getFixationHeatmapData(engine(), settings({ normalization: 'mean' })))
    const meanB = ok(getFixationHeatmapData(slow, settings({ normalization: 'mean' })))
    expect(meanB.max).not.toBeCloseTo(meanA.max, 1)
  })

  it('counts only located fixations in W_j and N; reports the rest', () => {
    const data = ok(getFixationHeatmapData(engineOf([[], [P0, P1, [[0, 100, NaN, NaN]], []]]), settings()))
    expect(data.participants.map(p => p.id)).toEqual([0, 1])
    expect(data.participants[1].total).toBe(900)
    // P2 was recorded but has no located fixation; P3 never saw the stimulus and is no warning.
    expect(data.summary).toMatchObject({ fixations: 5, withoutCoordinates: 2, participantsWithout: 1, selected: 3 })
  })

  it('frames the same domain and grid for every selection and time range', () => {
    const e = engineOf([[], [P0, P1]], { participantsSelections: [{ id: 5, name: 'Experts', participantsIds: [1] }] })
    const all = ok(getFixationHeatmapData(e, settings()))
    const experts = ok(getFixationHeatmapData(e, settings({ participantSelectionId: 5 })))
    const late = ok(getFixationHeatmapData(e, settings({ timelineStart: 400 })))
    expect(experts.grid).toEqual(all.grid)
    expect(late.grid).toEqual(all.grid)
    expect(experts.extent).toEqual(all.extent)
  })

  it('takes one auto radius for the whole dataset, from its robust extent', () => {
    const e = engineOf([[[[0, 100, 0, 0], [100, 200, 1000, 500]]], [P0, P1]])
    const s0 = ok(getFixationHeatmapData(e, settings({ stimulusId: 0, radius: 0 })))
    const s1 = ok(getFixationHeatmapData(e, settings({ stimulusId: 1, radius: 0 })))
    expect(s0.radius).toBe(s1.radius)
    expect(s1.radius).toBe(autoRadius(e.getReader()!, null))
  })

  it('clamps a far outlier out of the view without media, and says so', () => {
    const next = rng(5)
    const field: Fix[] = Array.from({ length: 300 }, (_, k) => [k * 10, k * 10 + 8, next() * 400, next() * 300])
    const data = ok(getFixationHeatmapData(engineOf([[], [[...field, [4000, 4100, 90000, 90000]]]]), settings()))
    expect(data.extent.x + data.extent.width).toBeLessThan(1000)
    expect(data.summary.outside).toBe(1)
    // Below the robust extent's sample size an outlier IS the extent: nothing is hidden.
    const few = ok(getFixationHeatmapData(engineOf([[], [[...P0, [1500, 1600, 90000, 90000]]]]), settings()))
    expect(few.summary.outside).toBe(0)
  })

  it('counts as outside view only what lies beyond the drawn kernel margin', () => {
    const next = rng(9)
    const field: Fix[] = Array.from({ length: 300 }, (_, k) => [k * 10, k * 10 + 8, next() * 400, next() * 300])
    const probe = (x: number) => {
      const data = ok(getFixationHeatmapData(engineOf([[], [[...field, [4000, 4100, x, 150]]]]), settings()))
      return { outside: data.summary.outside, edge: data.extent.x + data.extent.width }
    }
    const { edge } = probe(10_000)
    expect(probe(10_000).outside).toBe(1)
    expect(probe(edge + 10).outside).toBe(0)
    expect(probe(edge + 40).outside).toBe(1)
  })

  it('flags a grid the cell budget made too coarse for the radius', () => {
    const big = { x: 0, y: 0, width: 40_000, height: 30_000 }
    expect(isCoarseGrid(gridFor(big, 20), 20)).toBe(true)
    expect(isCoarseGrid(gridFor(big, 2000), 2000)).toBe(false)
    expect(isCoarseGrid(gridFor({ x: 0, y: 0, width: 1920, height: 1080 }, 20), 20)).toBe(false)
  })

  it('with media: clips to the media rect, takes the peak inside it, counts the rest as outside', () => {
    const e = engineOf([[], [P0, [...P1.slice(0, 2), [1000, 1900, 2000, 2000]]]])
    const media: StimulusMedia = { kind: 'image', mimeType: 'image/png', fileName: 's.png', naturalWidth: 400, naturalHeight: 300 }
    e.metadata!.stimuliMedia = { 1: media }
    const data = ok(getFixationHeatmapData(e, settings()))
    expect(data.clip).toEqual({ x: 0, y: 0, width: 400, height: 300 })
    expect(data.summary.outside).toBe(1)
    e.metadata!.stimuliMedia = { 1: { ...media, region: { x: 5000, y: 5000, width: 400, height: 300 } } }
    expect(getFixationHeatmapData(e, settings())).toEqual({ kind: 'unavailable', reason: 'none-on-media' })
  })

  it('reuses the map across view-only edits and recomputes when its inputs change', () => {
    const e = engine()
    const first = ok(getFixationHeatmapData(e, settings()))
    expect(ok(getFixationHeatmapData(e, settings({ view: 'opacity', opacity: 40, scaleMax: 3, colorScale: ['#000000', '#ffffff'] })))).toBe(first)
    expect(ok(getFixationHeatmapData(e, settings({ normalization: 'mean' })))).not.toBe(first)
    e.metadata!.participants.data[0][1] = 'Renamed'
    const renamed = ok(getFixationHeatmapData(e, settings()))
    expect(renamed).not.toBe(first)
    expect(renamed.participants[0].name).toBe('Renamed')
  })

  it('names why it cannot draw', () => {
    const e = engine()
    expect(getFixationHeatmapData(e, settings({ timelineStart: 5000 }))).toEqual({ kind: 'unavailable', reason: 'none-in-range' })
    expect(getFixationHeatmapData(engineOf([[], [[], []]]), settings())).toEqual({ kind: 'unavailable', reason: 'no-fixations' })
    expect(getFixationHeatmapData(engineOf([[], [[[0, 100, NaN, NaN]]]]), settings())).toEqual({ kind: 'unavailable', reason: 'no-coordinates' })
    expect(getFixationHeatmapData(makeTestEngine([[], [[[0, 100, 0]]]]), settings())).toEqual({ kind: 'unavailable', reason: 'no-spatial-data' })
  })
})

describe('background', () => {
  const image: StimulusMedia = { kind: 'image', mimeType: 'image/png', fileName: 's.png', naturalWidth: 400, naturalHeight: 300 }
  const props = (media: StimulusMedia | null, background: FixationHeatmapPlotSettings['background']) => {
    const e = engineOf([[], [P0, P1]])
    if (media) e.metadata!.stimuliMedia = { 1: media }
    return deriveFixationHeatmapView(e, settings({ background })).props
  }

  it('passes the image with its treatment, and no image for None or a video', () => {
    expect(props(image, 'dimmed')).toMatchObject({ media: image, background: 'dimmed' })
    expect(props(image, 'none')).toMatchObject({ media: null, background: 'image' })
    expect(props({ ...image, kind: 'video', mimeType: 'video/mp4' }, 'grayscale')).toMatchObject({ media: null })
  })

  it('falls back to plain drawing without an image', () => {
    expect(props(null, 'grayscale')).toMatchObject({ media: null, background: 'image' })
  })

  it('keeps heat clipped to the media rect even when the image is not drawn', () => {
    const data = props(image, 'none').data as FixationHeatmapData
    expect(data.clip).toEqual({ x: 0, y: 0, width: 400, height: 300 })
  })
})

describe('heat image', () => {
  it('fades in from transparent and reaches full opacity at the top', () => {
    const lut = heatLut(['#ffeda0', '#fd8d3c', '#bd0026'], 0.7)
    expect(lut[0] >>> 24).toBe(0)
    expect(lut[lut.length - 1] >>> 24).toBe(Math.round(0.7 * 255))
    expect(fadeIn(0)).toBe(0)
    expect(fadeIn(1)).toBe(1)
    const out = new Uint32Array(3)
    paintHeat(Float32Array.from([0, 50, 500]), 100, lut, out)
    expect(out[0]).toBe(0)
    expect(out[2]).toBe(lut[lut.length - 1])
  })

  it('draws the legend from the same table, composited over white', () => {
    const lut = heatLut(['#000000', '#ffffff'], 1)
    const ramp = legendRamp(lut, 5)
    expect(ramp[0]).toBe('#ffffff')
    expect(ramp[4]).toBe('#ffffff')
    const dark = legendRamp(heatLut(['#000000', '#000000'], 0.5), 2)
    expect(dark[1]).toBe('#7f7f7f')
  })

  it('masks fully where nobody looked and clears linearly to the top', () => {
    const lut = maskLut('#102030', 0.9)
    expect(lut[0]).toBe(((Math.round(0.9 * 255) << 24) | (0x30 << 16) | (0x20 << 8) | 0x10) >>> 0)
    expect(lut[lut.length - 1] >>> 24).toBe(0)
    const out = new Uint32Array(3)
    paintHeat(Float32Array.from([0, 50, 500]), 100, lut, out, lut[0])
    expect(out[0]).toBe(lut[0])
    expect(out[1] >>> 24).toBeCloseTo(0.45 * 255, -1)
    expect(out[2]).toBe(lut[lut.length - 1])
    expect(legendRamp(maskLut('#000000', 1), 2)).toEqual(['#000000', '#ffffff'])
  })
})

describe('labels', () => {
  it('titles the colour: quantity, R, N, time range', () => {
    const data = ok(getFixationHeatmapData(engineOf([[], [P0, P1]]), settings({ timelineStart: 1000 })))
    expect(heatmapLegendTitle(settings({ timelineStart: 1000 }), data)).toBe(
      'Fixation duration share / % · R = 30 · N = 1 · t ≥ 1000 ms'
    )
    const all = ok(getFixationHeatmapData(engineOf([[], [P0, P1]]), settings({ normalization: 'mean' })))
    expect(heatmapLegendTitle(settings({ normalization: 'mean', scaleMax: 5 }), all)).toBe(
      'Fixation duration / ms · R = 30 · N = 2'
    )
    const auto = ok(getFixationHeatmapData(engineOf([[], [P0, P1]]), settings({ radius: 0 })))
    expect(heatmapLegendTitle(settings({ radius: 0 }), auto)).toMatch(/ · R = [\d.]+ · N = 2$/)
  })

  it('notes only what the map leaves out', () => {
    const data = ok(getFixationHeatmapData(engineOf([[], [P0, P1]]), settings()))
    expect(heatmapNotes(data, false)).toEqual(['1 fixation without coordinates'])
    expect(heatmapNotes(data, true)).toEqual(['Video background not drawn', '1 fixation without coordinates'])
  })

  it('formats amounts in plain digits, never grouping thousands', () => {
    expect(formatAmount(12345.6)).toBe('12346')
    expect(formatAmount(1380)).toBe('1380')
    expect(formatAmount(-2500)).toBe('-2500')
    expect(formatAmount(8.32)).toBe('8.3')
    expect(formatAmount(0.0123)).toBe('0.012')
  })

  it('rounds the auto top up at the third significant digit', () => {
    expect(niceCeil(1380.457)).toBe(1390)
    expect(niceCeil(4.1234)).toBe(4.13)
    expect(niceCeil(0)).toBe(0)
  })
})

describe('onCommand', () => {
  const item = (scaleMax: number) =>
    ({ id: 7, settings: settings({ scaleMax }) }) as unknown as Parameters<NonNullable<typeof fixationHeatmapDefinition.onCommand>>[1]
  const run = (patch: Record<string, unknown>, scaleMax: number) => {
    const dispatch = vi.fn()
    fixationHeatmapDefinition.onCommand!(
      { type: 'updateSettings', updates: [{ itemId: 7, settings: patch }], source: 'test' } as never,
      item(scaleMax),
      {} as DataEngine,
      dispatch
    )
    return dispatch
  }

  it('resets Scale max to Auto when its unit changes', () => {
    expect(run({ accumulate: 'count' }, 500)).toHaveBeenCalledWith(
      expect.objectContaining({ updates: [{ itemId: 7, settings: { scaleMax: 0 } }] })
    )
    expect(run({ normalization: 'mean' }, 500)).toHaveBeenCalledTimes(1)
  })

  it('leaves an explicit or already-auto Scale max alone', () => {
    expect(run({ accumulate: 'count', scaleMax: 3 }, 500)).not.toHaveBeenCalled()
    expect(run({ accumulate: 'count' }, 0)).not.toHaveBeenCalled()
    expect(run({ opacity: 50 }, 500)).not.toHaveBeenCalled()
  })
})

describe('color sync', () => {
  const meta = (over: Partial<FixationHeatmapPlotSettings>) =>
    deriveFixationHeatmapView(engineOf([[], [P0, P1]]), settings({ stimulusId: 1, ...over })).meta as
      | { ownScaleTop: number; syncGroupKey: string }
      | undefined

  it('offers an auto scale for sync, keyed on what the colors measure', () => {
    const auto = meta({})!
    expect(auto.ownScaleTop).toBeGreaterThan(0)
    expect(meta({ accumulate: 'count' })!.syncGroupKey).not.toBe(auto.syncGroupKey)
    expect(meta({ radius: 99 })!.syncGroupKey).not.toBe(auto.syncGroupKey)
    expect(meta({ opacity: 20 })!.syncGroupKey).toBe(auto.syncGroupKey)
  })

  it('tops the opacity map at half the peak and keeps it out of heatmap sync', () => {
    const heat = meta({})!
    const mask = meta({ view: 'opacity' })!
    expect(mask.ownScaleTop).toBeCloseTo(niceCeil(heat.ownScaleTop / 2), 1)
    expect(mask.syncGroupKey).not.toBe(heat.syncGroupKey)
    expect(meta({ view: 'opacity', maskOpacity: 50 })!.syncGroupKey).toBe(mask.syncGroupKey)
  })

  it('leaves a set Scale max out of sync', () => {
    expect(meta({ scaleMax: 5 })).toBeUndefined()
  })
})
