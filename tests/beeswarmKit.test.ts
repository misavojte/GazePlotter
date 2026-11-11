/**
 * The beeswarm kit (`shared/distribution/beeswarm/kit.ts`): the one kit behind
 * the AOI, Event and Eye-movement Comparison. Pure functions, so no canvas host:
 * build a scene from an input, then hit-test and draw it into a recording
 * context.
 */
import { describe, expect, it } from 'vitest'
import { beeswarmKit, type BeeswarmInput } from '$lib/plots/shared/distribution/beeswarm/kit'
import { DOT_RADIUS, dimmedColor, valueToPixel } from '$lib/plots/shared/distribution/beeswarm/renderers'
import { FONT_PRIMARY } from '$lib/plots/shared/const'
import { computeSummaryStatistics } from '$lib/plots/shared/distribution/summaryStatistics'
import type { CategoryDistribution } from '$lib/plots/shared/distribution/types'
import type { SceneContext } from '$lib/plots/shared/kit'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { recordingContext } from './helpers/canvasRecorder'

function slot(label: string, values: number[], names?: string[]): CategoryDistribution {
  return {
    value: values.reduce((a, b) => a + b, 0) / (values.length || 1),
    label,
    color: '#336699',
    stats: values.length ? computeSummaryStatistics(values) : null,
    individualValues: values,
    individualParticipantNames: names ?? values.map((_, i) => `P${i + 1}`),
  }
}

function input(over: Partial<BeeswarmInput> = {}): BeeswarmInput {
  return {
    data: [slot('AOI A', [10, 20, 30, 40]), slot('AOI B', [50, 60, 70])],
    timeline: createAdaptiveTimeline(0, 100, 6),
    axisLabel: 'Dwell time / ms',
    orientation: 'horizontal',
    statisticalOverlay: 'meanCi95',
    unit: 'ms',
    itemTooltipKey: 'AOI',
    cannotFitHints: ['Merge some AOIs'],
    ...over,
  }
}

/** A frame inset like the harness's: the scene reads the rect it is handed. */
function sceneOf(i: BeeswarmInput, width = 600, height = 400) {
  const size = { width, height, margin: 0 }
  const chrome = beeswarmKit.chrome!(i, size)
  const x = 80
  const y = 10
  const w = width - x - 10
  const h = height - y - 50
  const ctx: SceneContext<typeof chrome> = {
    frame: { x, y, width: w, height: h, right: x + w, bottom: y + h, legendY: height, leftTitleOffset: 0, bottomTitleOffset: 0 },
    size,
    chrome,
    pixelRatio: 1,
    gradientLegend: null,
  }
  return { scene: beeswarmKit.scene(i, ctx), ctx, chrome }
}

describe('beeswarm kit', () => {
  it('declares the data placeholders in the chrome, missing metric first', () => {
    const size = { width: 600, height: 400, margin: 0 }
    const chrome = (over: Partial<BeeswarmInput>) => beeswarmKit.chrome!(input(over), size).placeholder
    expect(chrome({})).toBeNull()
    expect(chrome({ noMetric: true, noParticipants: true, data: [] })).toBe(METRIC_MISSING_MESSAGE)
    expect(chrome({ noParticipants: true, data: [] })).toMatchObject({
      message: 'No participants in this selection have data on this stimulus.',
    })
    const empty = { message: 'No AOIs to show on this stimulus.' }
    expect(chrome({ data: [], emptyPlaceholder: empty })).toBe(empty)
    expect(chrome({ data: [] })).toBe('Nothing to compare on this stimulus')
  })

  it('reserves the row-label column on the left, or the dot radius on top when vertical', () => {
    const size = { width: 600, height: 400, margin: 0 }
    const horizontal = beeswarmKit.chrome!(input(), size)
    expect(horizontal.gutters.pad.left).toBeGreaterThan(0)
    expect(horizontal.rowLabels).toEqual(['AOI A', 'AOI B'])
    expect(horizontal.axes.bottom?.title).toBe('Dwell time / ms')
    const vertical = beeswarmKit.chrome!(input({ orientation: 'vertical' }), size)
    expect(vertical.gutters.pad.top).toBe(DOT_RADIUS)
    expect(vertical.axes.left?.title).toBe('Dwell time / ms')
    expect(vertical.axes.bottom?.reserve).toEqual(['AOI A', 'AOI B'])
  })

  it('splits the category axis of the frame into equal slots', () => {
    const { scene, ctx } = sceneOf(input())
    const { frame } = ctx
    const slotWidth = frame.height / 2
    expect(scene.layout.items.map(item => item.categoryCenter)).toEqual([
      frame.y + slotWidth / 2,
      frame.y + slotWidth * 1.5,
    ])
    expect(scene.layout.items[0].categoryWidth).toBe(slotWidth)
    expect(scene.layout.plotLeft).toBe(frame.x)
    expect(scene.statisticalOverlay).toBe('meanCi95')
    expect(scene.categoryLabelOffset).toBeGreaterThan(6)
  })

  it('guards a row too thin to hold the swarm', () => {
    const roomy = sceneOf(input())
    expect(beeswarmKit.fit!(roomy.scene, roomy.ctx)).toBeNull()
    const many = input({ data: Array.from({ length: 80 }, (_, i) => slot(`AOI ${i}`, [i])) })
    const tight = sceneOf(many)
    expect(beeswarmKit.fit!(tight.scene, tight.ctx)).toMatchObject({
      message: 'The plot cannot fit the current height. Either:',
      steps: expect.arrayContaining(['Merge some AOIs']),
    })
  })

  it('hit-tests a dot into its participant, and empty value space into the stats', () => {
    const { scene, ctx } = sceneOf(input())
    const row = scene.layout.items[0]
    const onDot = valueToPixel(scene.layout, 20, true)
    const hit = beeswarmKit.hit!(scene, onDot, row.categoryCenter, ctx.frame, scene.input)
    expect(hit?.data).toEqual({ rowIndex: 0, valuePx: onDot })
    expect(hit?.content[0]).toEqual({ key: 'AOI', value: 'AOI A' })
    expect(hit?.content[1].key).toBe('At pointer')
    expect(hit?.content[1].value).toMatch(/ ms$/)
    expect(hit?.content[2]).toEqual({ key: 'Nearby', value: 'P2' })

    const empty = valueToPixel(scene.layout, 90, true)
    const stats = beeswarmKit.hit!(scene, empty, row.categoryCenter, ctx.frame, scene.input)
    expect(stats?.content[2]).toEqual({ key: 'Stats', value: 'n = 4' })
    expect(stats?.content.find(r => r.value.startsWith('Mean'))?.value).toBe('Mean = 25 ms')

    expect(beeswarmKit.hit!(scene, onDot, ctx.frame.bottom + 5, ctx.frame, scene.input)).toBeNull()
  })

  it('has no cursor marks: the overlay repaints for its own hover only', () => {
    expect(beeswarmKit.overlay?.key).toBeUndefined()
    expect(beeswarmKit.hover).toBeUndefined()
  })

  it('draws ground, labels, dots, the summary and the crosshair', () => {
    const { scene, ctx } = sceneOf(input())
    const rec = recordingContext()
    beeswarmKit.draw(rec.ctx, scene, ctx.frame)
    expect(rec.count('fillText')).toBe(2)
    beeswarmKit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
    expect(rec.count('arc')).toBe(7)
    expect(rec.count('stroke')).toBeGreaterThan(0)
    const before = rec.calls.length
    beeswarmKit.overlay!.draw(rec.ctx, scene, ctx.frame, {
      hover: { rowIndex: 1, valuePx: 300 },
      cursor: { times: [], participants: [] },
      input: scene.input,
    })
    expect(rec.calls.length).toBeGreaterThan(before)
  })

  it('draws a proportion as bars, never a swarm', () => {
    const { scene, ctx } = sceneOf(input({ proportion: true }))
    const rec = recordingContext()
    beeswarmKit.draw(rec.ctx, scene, ctx.frame)
    beeswarmKit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
    expect(rec.count('arc')).toBe(0)
    // The plot ground plus one bar per slot.
    expect(rec.count('fillRect')).toBeGreaterThanOrEqual(2)
  })

  const ided = () => [
    { ...slot('AOI A', [10, 20, 30, 40]), id: '1' },
    { ...slot('AOI B', [50, 60, 70]), id: '-1' },
  ]

  it('fades the slots off the highlight, label included, as a legend does', () => {
    const { scene, ctx } = sceneOf(input({ data: ided(), highlights: ['1', '9'] }))
    expect(scene.layout.items.map(i => i.dimmed)).toEqual([false, true])
    // The labels take the legend's faded text colour.
    const rec = recordingContext()
    const labels: [string, unknown][] = []
    rec.ctx.fillText = (text: string) => labels.push([text, rec.ctx.fillStyle])
    beeswarmKit.draw(rec.ctx, scene, ctx.frame)
    expect(labels[0]).toEqual(['AOI A', FONT_PRIMARY.COLOR])
    expect(labels[1]).toEqual(['AOI B', dimmedColor(FONT_PRIMARY.COLOR)])
    // A highlight this plot does not draw fades nothing.
    const other = sceneOf(input({ data: ided(), highlights: ['9'] })).scene
    expect(other.layout.items.map(i => i.dimmed)).toEqual([false, false])
  })

  it('toggles a highlight from a category label, in either orientation', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const { scene, ctx } = sceneOf(input({ data: ided(), highlights: ['1'], orientation }))
      const { frame } = ctx
      const row = scene.layout.items[1]
      const at =
        orientation === 'horizontal'
          ? ([frame.x - 10, row.categoryCenter] as const)
          : ([row.categoryCenter, frame.bottom + 5] as const)
      const hit = beeswarmKit.hitChrome!(scene, ...at, frame, ctx)
      expect(hit?.data).toEqual({ label: 1 })
      expect(hit?.content).toEqual([{ key: '', value: 'Highlight AOI B' }])
      expect(hit?.cursor).toBe('pointer')
      const toggled: unknown[] = []
      beeswarmKit.click!(hit!.data!, { scene: () => scene, toggle: (k: string, v: string) => toggled.push(k, v) } as never)
      expect(toggled).toEqual(['highlights', '-1'])
      // The label band is blocked, so a press there selects the plot.
      expect(beeswarmKit.blockedRegions!(scene, frame)).toHaveLength(2)
    }
    // Without ids the labels stay inert.
    const { scene, ctx } = sceneOf(input())
    expect(beeswarmKit.hitChrome!(scene, ctx.frame.x - 10, scene.layout.items[0].categoryCenter, ctx.frame, ctx)).toBeNull()
    expect(beeswarmKit.blockedRegions!(scene, ctx.frame)).toHaveLength(1)
  })
})
