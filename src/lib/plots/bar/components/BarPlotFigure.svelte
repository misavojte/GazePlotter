<script lang="ts">
  import {
    FONT_PRIMARY,
    ROW_LABEL_GAP,
    type AdaptiveTimeline,
    getTimelinePositionRatio,
    usePlot,
    NO_MARGINS,
    fillPlotAreaBackground,
    canvasBlockSelect,
    valueAxisTicks,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
    measureTextHeight,
  } from '$lib/shared/utils/textUtils'
  import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
  import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import type { StatisticalOverlayType, BarPlotDataItem } from '$lib/plots/bar/types'
  import {
    drawOverlayBackgrounds,
    drawCategoryDelimiters,
    drawBeeswarmPoints,
    drawProportionalBars,
    drawStatisticalOverlay,
    computeDotStyle,
    valueToPixel,
    type BarPlotLayout,
  } from '$lib/plots/bar/core/renderers'

  const MARGIN_RIGHT = 20
  const TICK_LENGTH = 5
  const BAR_SPACING_TOLERANCE = 20 // px padding on both sides of the bar region
  const VALUE_LABEL_OFFSET = 5
  const MIN_BAR_SPACING = 2
  const LABEL_FONT_SIZE = FONT_PRIMARY.SIZE
  const CATEGORY_LABEL_GAP = 6

  // Crosshair / hover constants
  const HIGHLIGHT_COLOR = '#007acc'
  const HIGHLIGHT_FILL_ALPHA = 0.2
  const HIGHLIGHT_DASH = [2, 2]

  interface Props extends CanvasExportProps {
    data: BarPlotDataItem[]
    timeline: AdaptiveTimeline
    axisLabel: string
    barPlottingType: 'horizontal' | 'vertical'
    barWidth: number
    barSpacing: number
    onDataHover: (
      data: { value: number; label: string; color: string } | null
    ) => void
    statisticalOverlay?: StatisticalOverlayType
    noMetric?: boolean
    proportion?: boolean
  }

  let {
    width,
    height,
    data,
    timeline,
    axisLabel,
    barPlottingType,
    barWidth,
    barSpacing,
    onDataHover,
    statisticalOverlay = 'none',
    dpiOverride = null,
    margins = NO_MARGINS,
    noMetric = false,
    proportion = false,
  }: Props = $props()

  const isVertical = $derived(barPlottingType === 'vertical')
  const niceTicks = $derived(timeline.ticks.filter(t => t.isNice))

  // State
  let hoveredBarIndex = $state<number | null>(null)
  let mouseValuePx = $state<number | null>(null)

  const categoryLabelHeight = $derived.by(() => {
    let max = 0
    for (const d of data) {
      const h = measureTextHeight(d.label, LABEL_FONT_SIZE)
      if (h > max) max = h
    }
    return max
  })
  const CATEGORY_LABEL_OFFSET = $derived(CATEGORY_LABEL_GAP + Math.ceil(categoryLabelHeight / 2))

  // Horizontal-bar category labels go in the LEFT gutter; cap their width so a
  // long AOI name can't eat the plot. (Vertical reserves left via the value axis.)
  const leftChrome = $derived(
    Math.floor(
      Math.min(
        width * 0.4,
        Math.min(150, calculateLabelOffset(data.map(d => d.label)) + ROW_LABEL_GAP)
      )
    )
  )

  // Horizontal value-label overflow past the canvas right edge (bespoke).
  const rightChrome = $derived.by(() => {
    if (isVertical) return MARGIN_RIGHT
    const values = data.map(d => d.value)
    if (values.length === 0) return MARGIN_RIGHT
    const maxValue = Math.max(0, ...values)
    const timelineMax = timeline.maxValue || 1
    const estimatedPlotAreaWidth = Math.max(
      100,
      width - margins.left - leftChrome - MARGIN_RIGHT - margins.right
    )
    const clippedValueRatio = Math.min(1, maxValue / timelineMax)
    const barEndX = margins.left + leftChrome + clippedValueRatio * estimatedPlotAreaWidth
    const labelWidth = maxValue.toString().length * LABEL_FONT_SIZE * 0.55
    const overflow = Math.max(0, barEndX + VALUE_LABEL_OFFSET + labelWidth - width)
    return Math.floor(MARGIN_RIGHT + Math.min(overflow, width * 0.3))
  })

  const plot = usePlot<{ barIndex: number; valuePx: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, timeline, axisLabel, barPlottingType, barWidth, barSpacing, statisticalOverlay, noMetric, proportion],
    placeholder: () => (noMetric ? METRIC_MISSING_MESSAGE : null),
    gutters: () =>
      isVertical
        ? {
            left: { tickLabels: niceTicks.map(t => t.label), title: axisLabel },
            bottom: { tickLabels: data.map(d => d.label) },
            pad: { top: TICK_LENGTH, right: MARGIN_RIGHT },
          }
        : {
            bottom: { tickLabels: niceTicks.map(t => t.label), title: axisLabel },
            pad: { top: TICK_LENGTH, left: leftChrome, right: rightChrome },
          },
    drawData: drawBars,
    clipData: false, // data layers self-clip; category labels live in the gutter
    axes: () => {
      const labelled = valueAxisTicks(timeline, { invert: isVertical })
      const mirror = valueAxisTicks(timeline, { invert: isVertical, ticksOnly: true })
      return isVertical
        ? { left: { ticks: labelled, title: axisLabel }, right: { ticks: mirror } }
        : { bottom: { ticks: labelled, title: axisLabel }, top: { ticks: mirror } }
    },
    drawOverlay: drawCrosshairHighlight,
    hitTest: computeHit,
    onHoverChange: (hit) => {
      const next = hit?.data ?? null
      const changed = (next?.barIndex ?? null) !== hoveredBarIndex
      hoveredBarIndex = next?.barIndex ?? null
      mouseValuePx = next?.valuePx ?? null
      if (changed) onDataHover(next ? data[next.barIndex] : null)
      return true
    },
  })

  // --- Geometry derived from the resolved data rect ---
  const geom = $derived.by(() => {
    const f = plot.frame
    const plotW = f.width
    const plotH = f.height
    const availableSpace = isVertical ? plotW : plotH

    const usableSpace = Math.max(0, availableSpace - BAR_SPACING_TOLERANCE * 2)
    const gaps = Math.max(1, data.length - 1)
    const spacingCap = Math.max(MIN_BAR_SPACING, Math.min(barSpacing, (usableSpace - data.length * 2) / gaps))
    const maxBarWidth = data.length > 0
      ? Math.max(1, (usableSpace - (data.length - 1) * spacingCap) / data.length)
      : barWidth
    const optimalBarWidth = data.length > 0 ? Math.min(barWidth, maxBarWidth) : barWidth

    const spaceForBars = data.length * optimalBarWidth
    const remaining = Math.max(0, availableSpace - spaceForBars - 2 * BAR_SPACING_TOLERANCE)
    const effectiveBarSpacing = data.length <= 1
      ? barSpacing
      : Math.max(MIN_BAR_SPACING, Math.min(barSpacing, remaining / (data.length - 1)))

    const fullCategoryWidth = data.length > 0 ? availableSpace / data.length : 0
    const totalBarWidth = data.length * optimalBarWidth
    const totalSpacing = (data.length - 1) * effectiveBarSpacing
    const startPosition =
      BAR_SPACING_TOLERANCE +
      Math.max(0, availableSpace - totalBarWidth - totalSpacing - 2 * BAR_SPACING_TOLERANCE) / 2

    const scaleValue = (value: number, clamp = true) =>
      Math.floor(getTimelinePositionRatio(timeline, value, clamp) * (isVertical ? plotH : plotW))

    const bars = data.map((item, index) => {
      const scaled = scaleValue(item.value, false)
      const along = startPosition + index * (optimalBarWidth + effectiveBarSpacing)
      if (isVertical) {
        return {
          x: f.x + along,
          y: f.y + plotH - scaled,
          width: optimalBarWidth,
          height: scaled,
          value: item.value,
          label: item.label,
          color: item.color,
        }
      }
      return {
        x: f.x,
        y: f.y + along,
        width: scaled,
        height: optimalBarWidth,
        value: item.value,
        label: item.label,
        color: item.color,
      }
    })

    const items = bars.map((_, index) => ({
      categoryCenter: (isVertical ? f.x : f.y) + (index + 0.5) * fullCategoryWidth,
      categoryWidth: fullCategoryWidth,
      data: data[index],
    }))

    const rendererLayout: BarPlotLayout = {
      plotLeft: Math.floor(f.x),
      plotTop: Math.floor(f.y),
      plotWidth: Math.floor(plotW),
      plotHeight: Math.floor(plotH),
      barPlottingType,
      timeline,
      items,
    }

    return { bars, rendererLayout, fullCategoryWidth }
  })

  function drawBars(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const { rendererLayout } = geom

    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.width, frame.height)
    ctx.clip()
    fillPlotAreaBackground(ctx, frame.x, frame.y, frame.width, frame.height, 'white')
    drawCategoryDelimiters(ctx, rendererLayout)
    if (proportion) {
      // Proportion metrics (e.g. noticed-rate): a plain proportional bar,
      // never a beeswarm of 0/1 dots.
      drawProportionalBars(ctx, rendererLayout)
    } else {
      drawOverlayBackgrounds(ctx, rendererLayout, statisticalOverlay)
      drawBeeswarmPoints(ctx, rendererLayout)
      drawStatisticalOverlay(ctx, rendererLayout, statisticalOverlay)
    }
    ctx.restore()

    drawCategoryLabels(ctx, frame)
  }

  /** Per-category labels along the category axis (one per bar). */
  function drawCategoryLabels(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = FONT_PRIMARY.COLOR
    ctx.textAlign = isVertical ? 'center' : 'right'
    ctx.textBaseline = 'middle'

    const items = geom.rendererLayout.items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (isVertical) {
        const text = truncateTextToPixelWidth(item.data.label, item.categoryWidth, LABEL_FONT_SIZE)
        ctx.fillText(
          text,
          alignToPixelCenter(item.categoryCenter),
          alignToPixelCenter(frame.bottom + CATEGORY_LABEL_OFFSET)
        )
      } else {
        const text = truncateTextToPixelWidth(item.data.label, leftChrome, LABEL_FONT_SIZE)
        ctx.fillText(text, frame.x - ROW_LABEL_GAP, alignToPixelCenter(item.categoryCenter))
      }
    }
  }

  function drawCrosshairHighlight(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (hoveredBarIndex === null || mouseValuePx === null) return
    const item = geom.rendererLayout.items[hoveredBarIndex]
    if (!item) return
    const { x: plotLeft, y: plotTop, width: plotWidth, height: plotHeight } = frame
    const halfCat = item.categoryWidth / 2

    ctx.save()
    ctx.globalAlpha = HIGHLIGHT_FILL_ALPHA
    ctx.fillStyle = HIGHLIGHT_COLOR
    if (isVertical) {
      ctx.fillRect(item.categoryCenter - halfCat, plotTop, item.categoryWidth, plotHeight)
    } else {
      ctx.fillRect(plotLeft, item.categoryCenter - halfCat, plotWidth, item.categoryWidth)
    }
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = HIGHLIGHT_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(HIGHLIGHT_DASH)
    ctx.beginPath()
    if (isVertical) {
      const left = alignToPixelCenter(item.categoryCenter - halfCat)
      const right = alignToPixelCenter(item.categoryCenter + halfCat)
      ctx.moveTo(left, plotTop)
      ctx.lineTo(left, plotTop + plotHeight)
      ctx.moveTo(right, plotTop)
      ctx.lineTo(right, plotTop + plotHeight)
      const y = alignToPixelCenter(mouseValuePx)
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(plotLeft + plotWidth, y)
    } else {
      const top = alignToPixelCenter(item.categoryCenter - halfCat)
      const bottom = alignToPixelCenter(item.categoryCenter + halfCat)
      ctx.moveTo(plotLeft, top)
      ctx.lineTo(plotLeft + plotWidth, top)
      ctx.moveTo(plotLeft, bottom)
      ctx.lineTo(plotLeft + plotWidth, bottom)
      const x = alignToPixelCenter(mouseValuePx)
      ctx.moveTo(x, plotTop)
      ctx.lineTo(x, plotTop + plotHeight)
    }
    ctx.stroke()
    ctx.restore()
  }

  // --- Hover / tooltip ---

  function fmt(v: number): string {
    return v % 1 === 0 ? v.toString() : v.toFixed(2)
  }

  function findNearbyParticipants(
    values: number[],
    names: string[],
    mousePx: number,
    tolerancePx: number,
    layout: BarPlotLayout
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

  function pushStats(content: FrameHit['content'], stats: BarPlotDataItem['stats']) {
    if (!stats || stats.count <= 0) return
    content.push(
      { key: 'Stats', value: `n = ${stats.count}` },
      { key: '', value: `x̄ = ${fmt(stats.mean)}` },
      { key: '', value: `x̃ = ${fmt(stats.median)}` },
      { key: '', value: `σ = ${fmt(stats.sd)}` },
      { key: '', value: `95% CI = ±${fmt(stats.sem * 1.96)}` }
    )
  }

  function computeHit(x: number, y: number, frame: PlotFrame): FrameHit<{ barIndex: number; valuePx: number }> | null {
    const layout = geom.rendererLayout
    const valuePx = isVertical ? y : x
    const categoryPos = isVertical ? x : y

    let barIndex: number | null = null
    for (let i = 0; i < layout.items.length; i++) {
      const item = layout.items[i]
      const half = item.categoryWidth / 2
      if (categoryPos >= item.categoryCenter - half && categoryPos <= item.categoryCenter + half) {
        barIndex = i
        break
      }
    }
    if (barIndex === null) return null

    const dataItem = data[barIndex]
    const ratio = isVertical
      ? 1 - (y - frame.y) / frame.height
      : (x - frame.x) / frame.width
    const mouseValue = timeline.minValue + ratio * (timeline.maxValue - timeline.minValue)

    const content: FrameHit['content'] = [
      { key: 'AOI', value: dataItem.label },
      { key: 'Value', value: fmt(mouseValue) },
    ]

    const tolerance = computeDotStyle(layout).radius
    const values = dataItem.individualValues
    const names = dataItem.individualParticipantNames
    if (values && names && values.length > 0) {
      const nearby = findNearbyParticipants(values, names, valuePx, tolerance, layout)
      if (nearby.length > 0) {
        const isMultiValue = names.length > new Set(names).size
        const maxShow = 4
        if (isMultiValue) {
          const counts = new Map<string, number>()
          for (const n of nearby) counts.set(n, (counts.get(n) ?? 0) + 1)
          const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
          for (let i = 0; i < Math.min(maxShow, sorted.length); i++) {
            content.push({ key: i === 0 ? 'Nearby' : '', value: `${sorted[i][0]} × ${sorted[i][1]}` })
          }
          if (sorted.length > maxShow) content.push({ key: '', value: `+${sorted.length - maxShow} others` })
        } else {
          const unique = [...new Set(nearby)]
          for (let i = 0; i < Math.min(maxShow, unique.length); i++) {
            content.push({ key: i === 0 ? 'Nearby' : '', value: unique[i] })
          }
          if (unique.length > maxShow) content.push({ key: '', value: `+${unique.length - maxShow} others` })
        }
      } else {
        pushStats(content, dataItem.stats)
      }
    } else {
      pushStats(content, dataItem.stats)
    }

    return {
      tooltipId: 'bar-crosshair',
      content,
      anchorX: x,
      anchorY: y,
      offset: { x: 15, y: 15 },
      tooltipWidth: 180,
      data: { barIndex, valuePx },
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  aria-label="AOI metrics visualization"
></canvas>
