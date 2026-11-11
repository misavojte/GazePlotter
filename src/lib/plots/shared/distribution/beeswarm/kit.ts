/**
 * The BEESWARM kit, behind every comparison plot (AOI, Event, Eye-movement
 * Comparison): one row per category slot, every individual value its own dot
 * along the value axis, an overlay statistic over it, or a plain proportional
 * bar for a rate metric. The per-plot vocabulary (tooltip noun, fit hints, empty
 * card, aria label) arrives in the input; nothing here speaks one consumer's
 * language by default.
 */
import { measureTextHeight, truncateTextToPixelWidth } from '$lib/shared/textMeasure'
import { rowLabelColumn } from '$lib/plots/shared/axisUtils'
import {
  alignToPixelCenter,
  clipRect,
  fillCrosshairBand,
  strokeCrosshairGuides,
} from '$lib/plots/shared/canvasUtils'
import { FONT_PRIMARY, PLOT_BORDER_PX, ROW_LABEL_GAP } from '$lib/plots/shared/const'
import {
  METRIC_MISSING_MESSAGE,
  NO_PARTICIPANTS_MESSAGE,
  cannotFitPlaceholder,
  type PlotPlaceholderContent,
} from '$lib/plots/shared/drawCanvasPlaceholder'
import type { FrameHit } from '$lib/plots/shared/frame'
import { defineKit } from '$lib/plots/shared/kit'
import { highlightTooltip } from '$lib/plots/shared/legendRendering'
import { TICK_LENGTH, fillPlotAreaBackground } from '$lib/plots/shared/plotArea'
import { valueAxisTicks } from '$lib/plots/shared/ticks'
import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { CategoryDistribution, StatisticalOverlayType } from '../types'
import {
  drawCategoryDelimiters,
  drawProportionalBars,
  drawStatisticalOverlay,
  drawSwarmPoints,
  DOT_PITCH,
  DOT_RADIUS,
  dimmedColor,
  valueToPixel,
  type BeeswarmLayout,
} from './renderers'

/**
 * How many dot-widths a row must be able to hold before the figure is willing to
 * draw it. Below this the band is barely thicker than the marks, every value
 * lands on or beside the centre line, and the swarm cannot say anything.
 * Rows are `availableSpace / rowCount` (no gaps, no end padding), so the guard
 * is in dot-widths and tracks the mark.
 */
const MIN_ROW_DOT_WIDTHS = 4
const LABEL_FONT_SIZE = FONT_PRIMARY.SIZE
const CATEGORY_LABEL_GAP = 6

export interface BeeswarmInput {
  data: CategoryDistribution[]
  timeline: AdaptiveTimeline
  axisLabel: string
  orientation: 'horizontal' | 'vertical'
  statisticalOverlay?: StatisticalOverlayType
  noMetric?: boolean
  /** No participant in the selection is on this stimulus. */
  noParticipants?: boolean
  proportion?: boolean
  /** The metric's unit, trailing every value in the tooltip; '' for none. */
  unit?: string
  /**
   * The per-plot disclosure strings: what a category slot IS (tooltip's first
   * row key), how to make the figure fit, what to say when the category axis
   * is empty, and how a screen reader names it. Neutral fallbacks only.
   */
  itemTooltipKey?: string
  cannotFitHints?: string[]
  emptyPlaceholder?: PlotPlaceholderContent
  ariaLabel?: string
  /**
   * Highlighted slot ids. The category labels are the legend: a label toggles
   * its slot, and while a drawn slot is highlighted the others fade, label
   * included, as legend items do.
   */
  highlights?: readonly string[]
}

/** The hovered row and the pointer's position along the value axis, or a hovered category label. */
export type BeeswarmHover = { rowIndex: number; valuePx: number } | { label: number }

function fmt(v: number, unit: string): string {
  const num = v % 1 === 0 ? v.toString() : v.toFixed(2)
  return unit ? `${num} ${unit}` : num
}

function findNearbyParticipants(
  values: number[],
  names: string[],
  mousePx: number,
  tolerancePx: number,
  layout: BeeswarmLayout
): string[] {
  const result: string[] = []
  for (let i = 0; i < values.length; i++) {
    if (!names[i]) continue
    if (Math.abs(valueToPixel(layout, values[i], true) - mousePx) <= tolerancePx) {
      result.push(names[i])
    }
  }
  return result
}

function pushStats(
  content: FrameHit['content'],
  stats: CategoryDistribution['stats'],
  unit: string
) {
  if (!stats || stats.count <= 0) return
  content.push(
    { key: 'Stats', value: `n = ${stats.count}` },
    { key: '', value: `Mean = ${fmt(stats.mean, unit)}` },
    { key: '', value: `Median = ${fmt(stats.median, unit)}` },
    { key: '', value: `SD = ${fmt(stats.sd, unit)}` },
    { key: '', value: `95% CI = ±${fmt(stats.sem * 1.96, unit)}` }
  )
}

export const beeswarmKit = defineKit<BeeswarmInput, BeeswarmHover>()({
  label: input => input.ariaLabel ?? 'Beeswarm plot',
  clip: false, // data layers self-clip; category labels live in the gutter

  chrome: (input, size) => {
    const { data, timeline } = input
    const isVertical = input.orientation === 'vertical'
    // Horizontal category labels, truncated to a capped left column so a long one can't eat the plot.
    const rowColumn = rowLabelColumn(
      data.map(d => d.label),
      Math.min(size.width * 0.4, 150)
    )
    const labelled = valueAxisTicks(timeline, { invert: isVertical })
    const mirror = valueAxisTicks(timeline, { invert: isVertical, ticksOnly: true })
    return {
      placeholder: input.noMetric
        ? METRIC_MISSING_MESSAGE
        : input.noParticipants
          ? NO_PARTICIPANTS_MESSAGE
          : data.length === 0
            ? (input.emptyPlaceholder ?? 'Nothing to compare on this stimulus')
            : null,
      // A dot on the value axis's min/max overhangs the border by its radius; the
      // opposite edge carries the mirrored tick marks.
      gutters: {
        pad: isVertical
          ? { top: DOT_RADIUS, right: TICK_LENGTH + PLOT_BORDER_PX }
          : { top: TICK_LENGTH, left: rowColumn.width, right: DOT_RADIUS + PLOT_BORDER_PX },
      },
      // Vertical: the category labels under the columns are the draw's own.
      axes: isVertical
        ? {
            left: { ticks: labelled, title: input.axisLabel },
            right: { ticks: mirror },
            bottom: { reserve: data.map(d => d.label) },
          }
        : { bottom: { ticks: labelled, title: input.axisLabel }, top: { ticks: mirror } },
      rowLabels: rowColumn.labels,
      rowLabelWidth: rowColumn.width,
    }
  },

  scene: (input, { frame, chrome }) => {
    const { data, timeline, orientation } = input
    const isVertical = orientation === 'vertical'
    const availableSpace = isVertical ? frame.width : frame.height

    // Slots only: the swarm spaces itself by the dot size, and the
    // proportional-bar path derives its own rects from these slots.
    const fullCategoryWidth = data.length > 0 ? availableSpace / data.length : 0
    // Whether each slot is highlighted; none drawn here means nothing fades.
    const highlights = input.highlights ?? []
    const lit = data.map(d => d.id !== undefined && highlights.includes(d.id))
    const fade = lit.includes(true)
    const items = data.map((item, index) => ({
      categoryCenter: (isVertical ? frame.x : frame.y) + (index + 0.5) * fullCategoryWidth,
      categoryWidth: fullCategoryWidth,
      data: item,
      dimmed: fade && !lit[index],
    }))

    const layout: BeeswarmLayout = {
      plotLeft: Math.floor(frame.x),
      plotTop: Math.floor(frame.y),
      plotWidth: Math.floor(frame.width),
      plotHeight: Math.floor(frame.height),
      orientation,
      timeline,
      items,
    }

    let categoryLabelHeight = 0
    for (const d of data) {
      const h = measureTextHeight(d.label, LABEL_FONT_SIZE, FONT_PRIMARY.FAMILY)
      if (h > categoryLabelHeight) categoryLabelHeight = h
    }

    return {
      input,
      layout,
      isVertical,
      lit,
      rowLabels: chrome.rowLabels,
      categoryLabelOffset: CATEGORY_LABEL_GAP + Math.ceil(categoryLabelHeight / 2),
      // How far the category labels reach out of the frame: the left row-label
      // column, or the label line under the columns.
      labelDepth: isVertical
        ? CATEGORY_LABEL_GAP + Math.ceil(categoryLabelHeight)
        : chrome.rowLabelWidth,
      proportion: input.proportion ?? false,
      statisticalOverlay: input.statisticalOverlay ?? 'none',
      unit: input.unit ?? '',
    }
  },

  fit: (scene, { frame }) => {
    const count = scene.layout.items.length
    if (count === 0) return null
    const availableSpace = scene.isVertical ? frame.width : frame.height
    const rowThickness = availableSpace / count
    if (rowThickness >= MIN_ROW_DOT_WIDTHS * DOT_PITCH) return null
    return cannotFitPlaceholder(
      scene.isVertical ? 'width' : 'height',
      scene.input.cannotFitHints ?? []
    )
  },

  /**
   * Everything that belongs UNDER the axis chrome: the plot ground, the row
   * delimiters, and the proportional bars when the metric is a rate. The swarm and
   * its summary are drawn over the chrome instead, in `drawAboveAxes`.
   */
  draw: (ctx, scene, frame) => {
    const { layout, isVertical } = scene

    ctx.save()
    clipRect(ctx, frame)
    fillPlotAreaBackground(ctx, frame.x, frame.y, frame.width, frame.height, 'white')
    drawCategoryDelimiters(ctx, layout)
    if (scene.proportion) {
      // Proportion metrics (e.g. noticed-rate): a plain proportional bar,
      // never a swarm of 0/1 dots. A bar grows from the baseline, so it has no
      // reason to overhang and stays in the tight clip.
      drawProportionalBars(ctx, layout)
    }
    ctx.restore()

    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_PRIMARY.FAMILY}`
    ctx.textAlign = isVertical ? 'center' : 'right'
    ctx.textBaseline = 'middle'

    const dimmedLabel = dimmedColor(FONT_PRIMARY.COLOR)
    const items = layout.items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      ctx.fillStyle = item.dimmed ? dimmedLabel : FONT_PRIMARY.COLOR
      if (isVertical) {
        const text = truncateTextToPixelWidth(item.data.label, item.categoryWidth, LABEL_FONT_SIZE, FONT_PRIMARY.FAMILY, '…')
        ctx.fillText(
          text,
          alignToPixelCenter(item.categoryCenter),
          alignToPixelCenter(frame.bottom + scene.categoryLabelOffset)
        )
      } else {
        ctx.fillText(scene.rowLabels[i], frame.x - ROW_LABEL_GAP, alignToPixelCenter(item.categoryCenter))
      }
    }
  },

  /**
   * The swarm and its summary, drawn OVER the axis chrome. `drawPlotArea` strokes
   * the plot border last, so drawing these with the rest of the data would let
   * that border slice through any dot sitting on the axis minimum or maximum.
   */
  drawAboveAxes: (ctx, scene, frame) => {
    if (scene.proportion) return
    const { layout } = scene

    // The dots get a clip widened by one radius ALONG THE VALUE AXIS, so a value
    // sitting on the axis minimum or maximum draws as a whole circle rather than a
    // half one. Only that axis: in the category direction the swarm's spread is
    // bounded by its slot, which already leaves the outermost dot a full radius
    // inside, and the gutters on the value axis are far wider than a radius.
    ctx.save()
    ctx.beginPath()
    if (scene.isVertical) {
      ctx.rect(frame.x, frame.y - DOT_RADIUS, frame.width, frame.height + DOT_RADIUS * 2)
    } else {
      ctx.rect(frame.x - DOT_RADIUS, frame.y, frame.width + DOT_RADIUS * 2, frame.height)
    }
    ctx.clip()
    drawSwarmPoints(ctx, layout)
    ctx.restore()

    // The summary keeps the tight clip. An SD whisker or a CI arm that runs past
    // the axis is cut at the border, because a statistic reaching outside the plot
    // would claim a range the axis does not show.
    ctx.save()
    clipRect(ctx, frame)
    drawStatisticalOverlay(ctx, layout, scene.statisticalOverlay)
    ctx.restore()
  },

  overlay: {
    draw: (ctx, scene, frame, { hover }) => {
      if (hover === null || !('rowIndex' in hover)) return
      const { rowIndex: hoveredRowIndex, valuePx: mouseValuePx } = hover
      const item = scene.layout.items[hoveredRowIndex]
      if (!item) return
      const { x: plotLeft, y: plotTop, width: plotWidth, height: plotHeight } = frame
      const halfCat = item.categoryWidth / 2

      if (scene.isVertical) {
        fillCrosshairBand(ctx, item.categoryCenter - halfCat, plotTop, item.categoryWidth, plotHeight, 0.2)
        const left = alignToPixelCenter(item.categoryCenter - halfCat)
        const right = alignToPixelCenter(item.categoryCenter + halfCat)
        const y = alignToPixelCenter(mouseValuePx)
        strokeCrosshairGuides(ctx, [
          left, plotTop, left, plotTop + plotHeight,
          right, plotTop, right, plotTop + plotHeight,
          plotLeft, y, plotLeft + plotWidth, y,
        ])
      } else {
        fillCrosshairBand(ctx, plotLeft, item.categoryCenter - halfCat, plotWidth, item.categoryWidth, 0.2)
        const top = alignToPixelCenter(item.categoryCenter - halfCat)
        const bottom = alignToPixelCenter(item.categoryCenter + halfCat)
        const x = alignToPixelCenter(mouseValuePx)
        strokeCrosshairGuides(ctx, [
          plotLeft, top, plotLeft + plotWidth, top,
          plotLeft, bottom, plotLeft + plotWidth, bottom,
          x, plotTop, x, plotTop + plotHeight,
        ])
      }
    },
  },

  hit: (scene, x, y, frame) => {
    const { layout, isVertical, unit } = scene
    const { timeline } = layout
    const valuePx = isVertical ? y : x
    const categoryPos = isVertical ? x : y

    let rowIndex: number | null = null
    for (let i = 0; i < layout.items.length; i++) {
      const item = layout.items[i]
      const half = item.categoryWidth / 2
      if (categoryPos >= item.categoryCenter - half && categoryPos <= item.categoryCenter + half) {
        rowIndex = i
        break
      }
    }
    if (rowIndex === null) return null

    const dataItem = layout.items[rowIndex].data
    const ratio = isVertical
      ? 1 - (y - frame.y) / frame.height
      : (x - frame.x) / frame.width
    const mouseValue = timeline.minValue + ratio * (timeline.maxValue - timeline.minValue)

    const content: FrameHit['content'] = [
      { key: scene.input.itemTooltipKey ?? 'Category', value: dataItem.label },
      // The axis value under the pointer, not a data point.
      { key: 'At pointer', value: fmt(mouseValue, unit) },
    ]

    // The cursor counts as being on a dot when it is within the dot, so the
    // tolerance IS the radius.
    const tolerance = scene.proportion ? 0 : DOT_RADIUS
    const values = dataItem.individualValues
    const names = dataItem.individualParticipantNames
    const nearby =
      values && names && values.length > 0
        ? findNearbyParticipants(values, names, valuePx, tolerance, layout)
        : []
    if (nearby.length > 0) {
      // A participant with several values in the category is listed once, with a count.
      const isMultiValue = names!.length > new Set(names).size
      const counts = new Map<string, number>()
      for (const n of nearby) counts.set(n, (counts.get(n) ?? 0) + 1)
      const listed = [...counts].sort((a, b) => b[1] - a[1])
      const maxShow = 4
      listed.slice(0, maxShow).forEach(([name, count], i) => {
        content.push({ key: i === 0 ? 'Nearby' : '', value: isMultiValue ? `${name} × ${count}` : name })
      })
      if (listed.length > maxShow) content.push({ key: '', value: `+${listed.length - maxShow} others` })
    } else {
      pushStats(content, dataItem.stats, unit)
    }

    return {
      content,
      anchorX: x,
      anchorY: y,
      offset: { x: 15, y: 15 },
      tooltipWidth: 180,
      data: { rowIndex, valuePx },
    }
  },

  // A category label toggles its slot's highlight, as a legend item does.
  hitChrome: (scene, x, y, frame) => {
    const index = categoryLabelAt(scene, x, y, frame)
    if (index === null) return null
    const item = scene.layout.items[index]
    return {
      content: highlightTooltip(item.data.label, scene.lit[index]),
      anchorX: scene.isVertical ? item.categoryCenter : frame.x - ROW_LABEL_GAP,
      anchorY: scene.isVertical
        ? frame.bottom + scene.labelDepth
        : item.categoryCenter + LABEL_FONT_SIZE / 2,
      offset: { x: 0, y: 7 },
      cursor: 'pointer',
      data: { label: index },
    }
  },

  click: (hover, act) => {
    if (hover === null || !('label' in hover)) return
    const id = act.scene()?.layout.items[hover.label]?.data.id
    if (id !== undefined) act.toggle('highlights', id)
  },

  // The data rect, plus the clickable label band beside it.
  blockedRegions: (scene, frame) => {
    const body = { x: frame.x, y: frame.y, w: frame.width, h: frame.height }
    if (!scene.layout.items.some(item => item.data.id !== undefined)) return [body]
    const band = scene.isVertical
      ? { x: frame.x, y: frame.bottom, w: frame.width, h: scene.labelDepth }
      : { x: frame.x - scene.labelDepth, y: frame.y, w: scene.labelDepth, h: frame.height }
    return [body, band]
  },
})

/** The slot whose category label is under the pointer, if it can toggle a highlight. */
function categoryLabelAt(
  scene: { isVertical: boolean; labelDepth: number; layout: BeeswarmLayout },
  x: number,
  y: number,
  frame: { x: number; bottom: number }
): number | null {
  const { isVertical, labelDepth, layout } = scene
  const across = isVertical ? y - frame.bottom : frame.x - x
  if (across < 0 || across > labelDepth) return null
  const along = isVertical ? x : y
  for (let i = 0; i < layout.items.length; i++) {
    const item = layout.items[i]
    const half = item.categoryWidth / 2
    if (along >= item.categoryCenter - half && along <= item.categoryCenter + half) {
      return item.data.id === undefined ? null : i
    }
  }
  return null
}
