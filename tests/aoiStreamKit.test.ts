/**
 * The AOI Timeline kit (`aoi-stream/core/kit.ts`). Pure functions, so no canvas
 * host: resolve the chrome into a frame the way the harness does, build a scene,
 * then hit-test, key and draw it into a recording context.
 */
import { describe, expect, it, vi } from 'vitest'
import { aoiStreamKit } from '$lib/plots/aoi-stream/core/kit'
import { isAutoTimeline, type AoiStreamInput } from '$lib/plots/aoi-stream/core/view'
import type { AoiStreamPlotResult, AoiStreamPlotSettings } from '$lib/plots/aoi-stream/types'
import type { PlotActions, SceneContext } from '$lib/plots/shared/kit'
import { NO_CURSOR } from '$lib/plots/shared/cursorMarks'
import { resolveFrameLayout, type PlotFrame } from '$lib/plots/shared/frame'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { recordingContext } from './helpers/canvasRecorder'

const kit = aoiStreamKit

/** Four bins of 100 ms over 0–400 ms; one row per AOI. */
function result(values: number[][], over: Partial<AoiStreamPlotResult> = {}): AoiStreamPlotResult {
  let maxValue = 0
  let maxTotal = 0
  const binCount = values[0]?.length ?? 0
  for (let b = 0; b < binCount; b++) {
    let total = 0
    for (const row of values) {
      total += row[b]
      if (row[b] > maxValue) maxValue = row[b]
    }
    if (total > maxTotal) maxTotal = total
  }
  return {
    series: values.map((row, i) => ({
      id: i + 1,
      label: `AOI ${i + 1}`,
      color: ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff', '#ffff00'][i % 6],
      values: Float32Array.from(row),
    })),
    timeline: createAdaptiveTimeline(0, binCount * 100, 6),
    binCount,
    windowSize: 100,
    stepSize: 100,
    maxTime: binCount * 100,
    participants: 3,
    maxTotal,
    maxValue,
    yAxisLabel: 'Dwell time / ms',
    unit: 'ms',
    windowLabel: '100 ms window',
    ...over,
  }
}

const VALUES = [
  [10, 0, 30, 5],
  [20, 40, 0, 5],
  [5, 5, 5, 5],
]

function input(
  settings: Partial<AoiStreamPlotSettings> = {},
  over: Partial<AoiStreamInput> = {}
): AoiStreamInput {
  return {
    data: result(VALUES),
    settings: { belowMinColor: '#111111', aboveMaxColor: '#eeeeee', ...settings } as AoiStreamPlotSettings,
    colorValueRange: [0, 0],
    ...over,
  }
}

/** The harness's frame for this chrome, minus the gradient band (not under test). */
function sceneOf(i: AoiStreamInput, width = 600, height = 400) {
  const size = { width, height, margin: 0 }
  const chrome = kit.chrome!(i, size)
  const resolved = resolveFrameLayout(
    chrome.gutters,
    { left: 0, top: 0, right: width, bottom: height },
    chrome.axes ?? {}
  )
  const frame: PlotFrame = {
    ...resolved.rect,
    leftTitleOffset: resolved.leftTitleOffset,
    bottomTitleOffset: resolved.bottomTitleOffset,
  }
  const ctx: SceneContext<typeof chrome> = {
    frame,
    size,
    chrome,
    pixelRatio: 1,
    gradientLegend: null,
  }
  return { scene: kit.scene(i, ctx), ctx, chrome, frame }
}

type Scene = ReturnType<typeof sceneOf>['scene']

/** The platform's actions over one scene, recording what the kit asks for. */
function actsOf({ scene, frame }: { scene: Scene; frame: PlotFrame }, i: AoiStreamInput) {
  return {
    scene: () => scene,
    input: () => i,
    frame: () => frame,
    settings: () => ({}) as AoiStreamPlotSettings,
    publish: vi.fn(),
    toggle: vi.fn(),
    draft: vi.fn(),
    commit: vi.fn(),
  } satisfies PlotActions<AoiStreamInput, Scene, AoiStreamPlotSettings>
}

describe('AOI Timeline kit', () => {
  it('paints the missing-metric placeholder from the chrome', () => {
    const chrome = kit.chrome!(input({}, { data: result([], { noMetric: true }) }), { width: 400, height: 300, margin: 0 })
    expect(chrome.placeholder).toBeTruthy()
    expect(kit.chrome!(input(), { width: 400, height: 300, margin: 0 }).placeholder).toBeNull()
  })

  it('draws no axes and builds no coordinates without bins', () => {
    const empty = input({}, { data: result([]) })
    expect(kit.chrome!(empty, { width: 400, height: 300, margin: 0 }).axes).toBeNull()
    const { scene } = sceneOf(empty)
    expect(scene.coords).toBeNull()
    expect(kit.hit!(scene, 100, 100, scene.frame, empty)).toBeNull()
  })

  it('mirrors the value ticks for stream, reserves AOI labels and a colorbar for the heatmap', () => {
    const stream = kit.chrome!(input(), { width: 600, height: 400, margin: 0 })
    expect(stream.axes?.right?.ticks?.positions).toEqual(stream.axes?.left?.ticks?.positions)
    expect(stream.gradientLegend).toBeNull()
    expect(stream.legendHeight).toBeGreaterThan(0)

    const heat = kit.chrome!(input({ alignment: 'heatmap' }), { width: 600, height: 400, margin: 0 })
    expect(heat.axes?.left?.reserve).toEqual(['AOI 1', 'AOI 2', 'AOI 3'])
    expect(heat.axes?.right).toBeUndefined()
    expect(heat.legendHeight).toBe(0)
    // Auto max: the colorbar ends at the data max, like the cells.
    expect(heat.gradientLegend?.effectiveMaxValue).toBe(40)
    expect(heat.axes?.bottom?.title).toBe('Elapsed time / ms · 100 ms window')
  })

  it('spans the stream across the frame and reuses its buffers across sizes', () => {
    const i = input()
    const a = sceneOf(i)
    const { xPositions } = a.scene.coords!.buckets
    expect(xPositions[0]).toBe(a.frame.x)
    expect(xPositions[VALUES[0].length + 1]).toBe(a.frame.x + a.frame.width)
    const buffers = a.scene.coords!.buckets
    const b = sceneOf(i, 800, 500)
    expect(b.scene.coords!.buckets).toBe(buffers)
    // A different result gets its own buffers.
    expect(sceneOf(input({}, { data: result(VALUES) })).scene.coords!.buckets).not.toBe(buffers)
  })

  it('dims every series but the highlighted ones', () => {
    const { scene } = sceneOf(input({}, { highlights: ['2'] }))
    expect(scene.coords!.seriesPaint.map(p => p.isDimmed)).toEqual([true, false, true])
    expect(sceneOf(input()).scene.coords!.seriesPaint.every(p => !p.isDimmed)).toBe(true)
  })

  it('colors heatmap bins, leaving empty bins transparent', () => {
    const { scene } = sceneOf(input({ alignment: 'heatmap' }))
    const colors = scene.coords!.seriesPaint[0].heatmapBinColors!
    // Render index i is bin i − 1; bin 1 of AOI 1 is 0.
    expect(colors[2]).toBe('transparent')
    expect(colors[1]).not.toBe('transparent')
    expect(kit.legend!.geometry(scene)).toBeNull()
  })

  it('guards a height too small for the rows or the stream', () => {
    const tall = sceneOf(input({ alignment: 'ridgeline' }))
    expect(kit.fit!(tall.scene, tall.ctx)).toBeNull()
    const many = Array.from({ length: 40 }, () => [1, 2, 3, 4])
    const short = sceneOf(input({ alignment: 'ridgeline' }, { data: result(many) }), 600, 200)
    const steps = kit.fit!(short.scene, short.ctx)
    expect(typeof steps === 'object' && steps?.steps).toContain(
      'Merge some AOIs in Plot Settings > Areas of Interest'
    )
    const flat = sceneOf(input(), 600, 90)
    expect(kit.fit!(flat.scene, flat.ctx)).not.toBeNull()
  })

  it('hit-tests a bin into its window, bin and AOI values', () => {
    const many = input({}, { data: result([[1], [2], [3], [4], [5], [6.5]]) })
    const { scene, frame } = sceneOf(many)
    const hit = kit.hit!(scene, frame.x + 5, frame.y + 5, frame, many)
    expect(hit?.data).toEqual({ kind: 'bin', binIndex: 0, x: frame.x + 5 })
    expect(hit?.content).toEqual([
      { key: 'Window', value: '0 ms – 100 ms' },
      { key: 'Bin', value: '1 of 1' },
      { key: 'AOI 6', value: '6.5 ms' },
      { key: 'AOI 5', value: '5 ms' },
      { key: 'AOI 4', value: '4 ms' },
      { key: 'AOI 3', value: '3 ms' },
      { key: 'Other 2 AOIs', value: '3 ms' },
    ])

    const i = input()
    const s = sceneOf(i)
    const last = kit.hit!(s.scene, s.frame.right - 1, s.frame.y + 5, s.frame, i)
    expect(last?.data?.binIndex).toBe(3)
  })

  it('keys the overlay on guide pixels inside the window, not on the cursor arrays', () => {
    const { scene } = sceneOf(input())
    const key = (times: number[]) => kit.overlay!.key!(scene, { times, participants: [] }, input())
    expect(kit.overlay!.key!(scene, NO_CURSOR, input())).toBe(':')
    expect(key([200])).not.toBe(':')
    expect(key([200])).toBe(key([200, 9999]))
    // No bins: the fabricated empty timeline takes no guide.
    const empty = sceneOf(input({}, { data: result([], { timeline: createAdaptiveTimeline(0, 100, 6) }) }))
    expect(kit.overlay!.key!(empty.scene, { times: [50], participants: [] }, input())).toBe(':')
  })

  it('publishes the hovered time live and retracts on a legend hover', () => {
    const i = input()
    const built = sceneOf(i)
    const act = actsOf(built, i)
    kit.hover!({ kind: 'bin', binIndex: 0, x: built.frame.x + built.frame.width / 2 }, act)
    const at = act.publish.mock.calls[0][0]
    expect(at.times()).toEqual([200])
    // No participant channel: every series is group-aggregated.
    expect(at.participants).toBeUndefined()
    kit.hover!({ kind: 'legend' }, act)
    expect(act.publish).toHaveBeenLastCalledWith(null)
  })

  it('toggles the clicked legend AOI', () => {
    const i = input()
    const built = sceneOf(i)
    const act = actsOf(built, i)
    const item = kit.legend!.geometry(built.scene)!.items[1]
    kit.click!({ kind: 'legend', item }, act)
    expect(act.toggle).toHaveBeenCalledWith('highlights', '2')
    kit.click!({ kind: 'bin', binIndex: 0, x: 0 }, act)
    expect(act.toggle).toHaveBeenCalledTimes(1)
  })

  it.each(['stream', 'distribution', 'ridgeline', 'heatmap'] as const)(
    'draws the %s alignment, its chrome and overlay',
    alignment => {
      const i = input({ alignment }, { highlights: ['1'] })
      const { scene, frame } = sceneOf(i)
      const rec = recordingContext()
      kit.draw(rec.ctx, scene, frame)
      kit.drawAboveAxes!(rec.ctx, scene, frame)
      kit.overlay!.draw(rec.ctx, scene, frame, {
        hover: { kind: 'bin', binIndex: 1, x: frame.x + 120 },
        cursor: { times: [150], participants: [] },
        input: i,
      })
      if (alignment === 'heatmap') expect(rec.count('fillRect')).toBeGreaterThan(0)
      else expect(rec.count('fill')).toBeGreaterThanOrEqual(VALUES.length)
      // The cursor guide and the hover line.
      expect(rec.count('stroke')).toBeGreaterThan(0)
    }
  )
})

describe('AOI Timeline view', () => {
  it('joins the timeline sync only with a fully auto timeline', () => {
    const s = (over: Partial<AoiStreamPlotSettings> = {}) =>
      ({ stimulusId: 1, absoluteStimuliLimits: [], timelineEnd: 0, ...over }) as AoiStreamPlotSettings
    expect(isAutoTimeline(s())).toBe(true)
    // A start alone keeps the max auto.
    expect(isAutoTimeline(s({ timelineStart: 100 }))).toBe(true)
    expect(isAutoTimeline(s({ timelineEnd: 300 }))).toBe(false)
    expect(isAutoTimeline(s({ absoluteStimuliLimits: [[0, 0], [50, 0]] }))).toBe(false)
    expect(isAutoTimeline(s({ absoluteStimuliLimits: [[0, 0], [0, 300]] }))).toBe(false)
  })
})
