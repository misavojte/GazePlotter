/**
 * The Metric Timeline kit (`evolving-metrics/core/kit.ts`): heatmap rows and the
 * overlay's density lines + mean/IQR aggregates. Pure functions, so no canvas
 * host: resolve the frame the way the harness does, build a scene, then
 * hit-test, publish and draw it into a recording context.
 */
import { describe, expect, it, vi } from 'vitest'
import { evolvingMetricsKit as kit } from '$lib/plots/evolving-metrics/core/kit'
import type { EvolvingMetricsInput } from '$lib/plots/evolving-metrics/core/view'
import type {
  EvolvingMetricsResult,
  EvolvingMetricsSettings,
  EvolvingMetricsWindow,
} from '$lib/plots/evolving-metrics/types'
import type { PlotActions, SceneContext } from '$lib/plots/shared/kit'
import { NO_CURSOR, type CursorRead } from '$lib/plots/shared/cursorMarks'
import { participantIndexAxisWidth } from '$lib/plots/shared/axisUtils'
import { PLOT_LEGEND_GAP } from '$lib/plots/shared/const'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { resolveFrameLayout, type PlotFrame } from '$lib/plots/shared/frame'
import { getGradientLegendRequiredHeight } from '$lib/plots/shared/legendGradient'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { recordingContext } from './helpers/canvasRecorder'

const win = (startMs: number, endMs: number, value: number): EvolvingMetricsWindow => ({
  startMs,
  endMs,
  centerMs: (startMs + endMs) / 2,
  value,
  windowStartMs: startMs - 50,
  windowEndMs: endMs + 50,
})

function result(over: Partial<EvolvingMetricsResult> = {}): EvolvingMetricsResult {
  return {
    participants: [
      { id: 10, label: 'Ana', windows: [win(0, 500, 2), win(500, 1000, 4)] },
      { id: 20, label: 'Ben', windows: [win(0, 500, 6), win(500, 1000, 8)] },
      // Only early data: the later time is a gap for Cy.
      { id: 30, label: 'Cy', windows: [win(0, 250, 1)] },
    ],
    timeline: createAdaptiveTimeline(0, 1000, 6),
    xAxisLabel: 'Elapsed time / ms',
    yAxisLabel: 'Average fixation duration / ms',
    maxTime: 1000,
    valueMin: 1,
    valueMax: 8,
    ...over,
  }
}

const input = ({
  data = result(),
  ...settings
}: Partial<EvolvingMetricsSettings> & { data?: EvolvingMetricsResult } = {}): EvolvingMetricsInput => ({
  data,
  settings: { presentation: 'heatmap', ...settings } as EvolvingMetricsSettings,
})

/** The frame the harness (`usePlot`) resolves from the chrome. */
function frameOf(chrome: ReturnType<NonNullable<typeof kit.chrome>>, width: number, height: number): PlotFrame {
  const gutters = chrome.gutters ?? {}
  const slot = chrome.gradientLegend
  const gradient = slot ? getGradientLegendRequiredHeight(slot.title, width) : 0
  const { rect, leftTitleOffset, bottomTitleOffset } = resolveFrameLayout(
    { ...gutters, legendHeight: (gutters.legendHeight ?? 0) + (gradient > 0 ? PLOT_LEGEND_GAP + gradient : 0) },
    { left: 0, top: 0, right: width, bottom: height },
    chrome.axes ?? {}
  )
  return { ...rect, leftTitleOffset, bottomTitleOffset }
}

function sceneOf(i: EvolvingMetricsInput, width = 600, height = 400) {
  const size = { width, height, margin: 0 }
  const chrome = kit.chrome!(i, size)
  const ctx: SceneContext<typeof chrome> = {
    frame: frameOf(chrome, width, height),
    size,
    chrome,
    pixelRatio: 1,
    gradientLegend: null,
  }
  return { scene: kit.scene(i, ctx), ctx, chrome }
}

/** Canvas x of an instant inside the frame. */
const xAt = (frame: PlotFrame, data: EvolvingMetricsResult, t: number) =>
  frame.x + ((t - data.timeline.minValue) / (data.timeline.maxValue - data.timeline.minValue)) * frame.width

type Scene = ReturnType<typeof sceneOf>['scene']

/** The platform's actions over a live scene, recording what the kit publishes. */
function actsOf(scene: () => Scene, frame: PlotFrame) {
  return {
    scene,
    input: () => input(),
    frame: () => frame,
    settings: () => ({}),
    publish: vi.fn(),
    toggle: vi.fn(),
    draft: vi.fn(),
    commit: vi.fn(),
  } satisfies PlotActions<EvolvingMetricsInput, Scene, Record<string, unknown>>
}

describe('metric timeline kit', () => {
  it('shows the missing-metric placeholder through the chrome', () => {
    const empty = input({ data: { ...result({ participants: [] }), noMetric: true } })
    const chrome = kit.chrome!(empty, { width: 400, height: 300, margin: 0 })
    expect(chrome.placeholder).toBe(METRIC_MISSING_MESSAGE)
    // The empty shell's timeline is fabricated: no axes are drawn over it.
    expect(chrome.axes).toBeNull()
  })

  it('reserves row labels and a colorbar for the heatmap, a value axis for the overlay', () => {
    const heat = sceneOf(input())
    expect(heat.chrome.placeholder).toBeNull()
    expect(heat.chrome.isCompact).toBe(false)
    expect(heat.chrome.axes?.left?.reserve).toEqual(['Ana', 'Ben', 'Cy'])
    expect(heat.chrome.gradientLegend?.valueRange).toEqual([1, 8])
    expect(heat.scene.participantLabels).toEqual(['Ana', 'Ben', 'Cy'])

    const over = sceneOf(input({ presentation: 'overlay' }))
    expect(over.chrome.gradientLegend).toBeNull()
    expect(over.chrome.axes?.left?.title).toBe('Average fixation duration / ms')
    expect(over.chrome.axes?.left?.ticks?.labels?.length).toBeGreaterThan(1)
    // The value axis runs to its nice max, which the lines are scaled to.
    expect(over.scene.yAxisMax).toBeGreaterThanOrEqual(8)
  })

  it('switches the heatmap to the index axis when the rows get too thin for names', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      id: i,
      label: `Participant ${i}`,
      windows: [win(0, 1000, i % 8)],
    }))
    const { chrome, scene } = sceneOf(input({ data: result({ participants: many }) }), 600, 600)
    expect(chrome.isCompact).toBe(true)
    expect(chrome.gutters.pad?.left).toBe(participantIndexAxisWidth(120))
    expect(chrome.axes?.left).toBeUndefined()
    expect(scene.participantLabels).toEqual([])
    // Overlay never goes compact: it has no rows.
    expect(sceneOf(input({ presentation: 'overlay', data: result({ participants: many }) }), 600, 600).chrome.isCompact).toBe(false)
  })

  it('builds the heatmap LUT once per palette, the overlay aggregates once per pixel column', () => {
    const scale = ['#ffffff', '#000000']
    const a = sceneOf(input({ colorScale: scale })).scene
    const b = sceneOf(input({ colorScale: scale }), 800, 500).scene
    expect(a.lut).toHaveLength(256)
    expect(b.lut).toBe(a.lut)
    expect(a.lut?.[0]).not.toBe(a.lut?.[255])
    expect(a.aggregates).toBeNull()

    const { scene, ctx } = sceneOf(input({ presentation: 'overlay' }))
    expect(scene.lut).toBeNull()
    const agg = scene.aggregates!
    expect(agg.sampleCount).toBe(Math.max(50, ctx.frame.width))
    // Early on all three contribute; later only Ana (4) and Ben (8).
    expect(agg.meanValues[0]).toBeCloseTo((2 + 6 + 1) / 3)
    const late = agg.sampleCount - 1
    expect(agg.meanValues[late]).toBeCloseTo(6)
    expect(agg.p25Values[late]).toBeCloseTo(5)
    expect(agg.p75Values[late]).toBeCloseTo(7)
  })

  it('gates the cursor band on real participants', () => {
    const { scene, ctx } = sceneOf(input())
    expect(scene.timeAxis.band).toBe(ctx.frame)
    expect(scene.timeAxis.rowIds).toEqual([10, 20, 30])
    expect(sceneOf(input({ data: result({ participants: [] }) })).scene.timeAxis.band).toBeNull()
  })

  it('guards heatmap rows thinner than 4 px, never the overlay', () => {
    const big = sceneOf(input())
    expect(kit.fit!(big.scene, big.ctx)).toBeNull()
    const many = Array.from({ length: 400 }, (_, i) => ({ id: i, label: `${i}`, windows: [win(0, 1000, 1)] }))
    const tight = sceneOf(input({ data: result({ participants: many }) }), 600, 400)
    expect(kit.fit!(tight.scene, tight.ctx)).toMatchObject({
      steps: expect.arrayContaining(['Switch to Overlay mode in Plot Settings > Visualization']),
    })
    const over = sceneOf(input({ presentation: 'overlay', data: result({ participants: many }) }), 600, 400)
    expect(kit.fit!(over.scene, over.ctx)).toBeNull()
  })

  it('hit-tests a heatmap row into its window tooltip and payload', () => {
    const { scene, ctx } = sceneOf(input())
    const f = ctx.frame
    const x = xAt(f, scene.data, 700)
    const y = f.y + (f.height / 3) * 1.5
    const hit = kit.hit!(scene, x, y, f, input())
    expect(hit?.data?.participantIdx).toBe(1)
    expect(hit?.data?.x).toBe(x)
    expect(hit?.data?.t).toBeCloseTo(700)
    expect(hit?.content).toEqual([
      { key: 'Participant', value: 'Ben' },
      { key: 'Window', value: '450–1050 ms' },
      { key: 'Average fixation duration / ms', value: '8.00' },
    ])
    // A row without a window at that instant still names the time.
    const gap = kit.hit!(scene, x, f.y + (f.height / 3) * 2.5, f, input())
    expect(gap?.content[1]).toEqual({ key: 'Time', value: '700 ms' })
    expect(gap?.content[2].value).toBe('No data')
    // The empty shell has nothing to hit.
    const empty = sceneOf(input({ data: result({ participants: [] }) }))
    expect(kit.hit!(empty.scene, 100, 100, empty.ctx.frame, input())).toBeNull()
  })

  it('hit-tests the overlay to the nearest line, tracking time where there is none', () => {
    const { scene, ctx } = sceneOf(input({ presentation: 'overlay' }))
    const f = ctx.frame
    const yOf = (v: number) => f.bottom - (v / scene.yAxisMax) * f.height
    const x = xAt(f, scene.data, 700)
    expect(kit.hit!(scene, x, yOf(4.2), f, input())?.data?.participantIdx).toBe(0)
    expect(kit.hit!(scene, x, yOf(7.5), f, input())?.data?.participantIdx).toBe(1)
    const none = sceneOf(input({ presentation: 'overlay', data: result({ participants: [{ id: 1, label: 'A', windows: [win(0, 100, 1)] }] }) }))
    const track = kit.hit!(none.scene, xAt(none.ctx.frame, none.scene.data, 700), 50, none.ctx.frame, input())
    expect(track?.content).toEqual([])
    expect(track?.data?.participantIdx).toBeNull()
  })

  it('keys the overlay on guide pixels and marked rows, not on the cursor arrays', () => {
    const { scene } = sceneOf(input())
    const key = (cursor: CursorRead) => kit.overlay!.key!(scene, cursor, input())
    expect(key(NO_CURSOR)).toBe(':')
    // Two instants inside one pixel column and an unknown id: one mark.
    const msPerPx = 1000 / scene.timeAxis.band!.width
    expect(key({ times: [500], participants: [20] })).toBe(
      key({ times: [500 + msPerPx * 0.01], participants: [20, 99] })
    )
    expect(key({ times: [], participants: [20] })).not.toBe(key({ times: [], participants: [10] }))
    // A time outside the window draws no guide.
    expect(key({ times: [5000], participants: [] })).toBe(':')
  })

  it('publishes live time and participant reads, and retracts on leave', () => {
    const { scene, ctx } = sceneOf(input())
    let current = scene
    const act = actsOf(() => current, ctx.frame)
    const x = xAt(ctx.frame, scene.data, 250)
    kit.hover!({ t: 250, x, participantIdx: 2 }, act)
    const at = act.publish.mock.calls[0][0]
    expect(at.times?.()[0]).toBeCloseTo(250, 0)
    expect(at.participants?.()).toEqual([30])
    // An undo that drops the hovered row reads back empty, never throws.
    current = sceneOf(input({ data: result({ participants: result().participants.slice(0, 1) }) })).scene
    expect(at.participants?.()).toEqual([])
    // The overlay's track-only hover publishes time only.
    kit.hover!({ t: 250, x, participantIdx: null }, act)
    expect(act.publish.mock.calls[1][0].participants).toBeUndefined()
    kit.hover!(null, act)
    expect(act.publish).toHaveBeenLastCalledWith(null)
  })

  for (const presentation of ['heatmap', 'overlay'] as const) {
    it(`draws the ${presentation} data, rows and overlay without throwing`, () => {
      const { scene, ctx } = sceneOf(input({ presentation }))
      const rec = recordingContext()
      kit.draw(rec.ctx, scene, ctx.frame)
      kit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
      kit.overlay!.draw(rec.ctx, scene, ctx.frame, {
        hover: { t: 700, x: xAt(ctx.frame, scene.data, 700), participantIdx: 1 },
        cursor: { times: [300], participants: [10] },
        input: input({ presentation }),
      })
      // A stale hover row from a wider participant set is ignored, not indexed.
      kit.overlay!.draw(rec.ctx, scene, ctx.frame, {
        hover: { t: 700, x: 0, participantIdx: 9 },
        cursor: NO_CURSOR,
        input: input({ presentation }),
      })
      if (presentation === 'heatmap') {
        // One cell per window, plus the row labels.
        expect(rec.count('fillRect')).toBeGreaterThanOrEqual(5)
        expect(rec.calls.filter(c => c.method === 'fillText').map(c => c.args[0])).toEqual(
          expect.arrayContaining(['Ana', 'Ben', 'Cy'])
        )
      } else {
        // The mean line, the hovered step line and the cursor's dashed one.
        expect(rec.count('stroke')).toBeGreaterThanOrEqual(3)
        expect(rec.count('fill')).toBeGreaterThanOrEqual(1)
      }
    })
  }
})
