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
    niceTimelineTicks,
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
  import {
    alignToPixelCenter,
    fillCrosshairBand,
    strokeCrosshairGuides,
  } from '$lib/plots/shared/canvasUtils'
  import {
    METRIC_MISSING_MESSAGE,
    cannotFitPlaceholder,
  } from '$lib/plots/shared/drawCanvasPlaceholder'
  import type { StatisticalOverlayType, CategoryDistribution } from '../types'
  import {
    drawOverlayBackgrounds,
    drawCategoryDelimiters,
    drawBeeswarmPoints,
    drawProportionalBars,
    drawStatisticalOverlay,
    computeDotStyle,
    valueToPixel,
    type BeeswarmLayout,
  } from './renderers'

  const MARGIN_RIGHT = 20
  const TICK_LENGTH = 5
  const BAR_SPACING_TOLERANCE = 20 // px padding on both sides of the bar region
  const VALUE_LABEL_OFFSET = 5
  const MIN_BAR_SPACING = 2
  const LABEL_FONT_SIZE = FONT_PRIMARY.SIZE
  const CATEGORY_LABEL_GAP = 6

  interface Props extends CanvasExportProps {
    data: CategoryDistribution[]
    timeline: AdaptiveTimeline
    axisLabel: string
    orientation: 'horizontal' | 'vertical'
    barWidth: number
    barSpacing: number
    onDataHover: (
      data: { value: number; label: string; color: string } | null
    ) => void
    statisticalOverlay?: StatisticalOverlayType
    noMetric?: boolean
    proportion?: boolean
    /**
     * The per-plot disclosure strings: what a category slot IS (tooltip's first
     * row key), how to make the figure fit, and how a screen reader names it.
     * Neutral fallbacks only — each plot passes its own entity vocabulary, so
     * the shared figure never speaks one consumer's language by default.
     */
    itemTooltipKey?: string
    cannotFitHints?: string[]
    ariaLabel?: string
  }

  let {
    width,
    height,
    data,
    timeline,
    axisLabel,
    orientation,
    barWidth,
    barSpacing,
    onDataHover,
    statisticalOverlay = 'none',
    dpiOverride = null,
    margins = NO_MARGINS,
    noMetric = false,
    proportion = false,
    itemTooltipKey = 'Category',
    cannotFitHints = [],
    ariaLabel = 'Beeswarm plot',
  }: Props = $props()

  const isVertical = $derived(orientation === 'vertical')
  const niceTickLabels = $derived(niceTimelineTicks(timeline).labels ?? [])

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
  // long category label can't eat the plot. (Vertical reserves left via the value axis.)
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
    deps: () => [data, timeline, axisLabel, orientation, barWidth, barSpacing, statisticalOverlay, noMetric, proportion],
    placeholder: () => (noMetric ? METRIC_MISSING_MESSAGE : null),
    fit: frame => {
      if (data.length === 0) return null
      const minBarWidth = 12
      const minSpacing = 4
      const gaps = Math.max(1, data.length - 1)
      const availableSpace = isVertical ? frame.width : frame.height
      const usableSpace = Math.max(0, availableSpace - BAR_SPACING_TOLERANCE * 2)
      if (usableSpace >= data.length * minBarWidth + gaps * minSpacing) return null
      return cannotFitPlaceholder(isVertical ? 'width' : 'height', cannotFitHints)
    },
    gutters: () =>
      isVertical
        ? {
            left: { tickLabels: niceTickLabels, title: axisLabel },
            bottom: { tickLabels: data.map(d => d.label) },
            pad: { top: TICK_LENGTH, right: MARGIN_RIGHT },
          }
        : {
            bottom: { tickLabels: niceTickLabels, title: axisLabel },
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
    hoverKey: d => d.barIndex,
    onHover: d => onDataHover(d ? data[d.barIndex] : null),
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

    const rendererLayout: BeeswarmLayout = {
      plotLeft: Math.floor(f.x),
      plotTop: Math.floor(f.y),
      plotWidth: Math.floor(plotW),
      plotHeight: Math.floor(plotH),
      orientation,
      timeline,
      items,
    }

    // Dot radius depends only on layout/data (not hover), so compute it here once
    // and reuse in both the draw and the per-frame hit-test. Proportion mode has
    // no beeswarm, so skip the density scan.
    const dotRadius = proportion ? 0 : computeDotStyle(rendererLayout).radius

    return { bars, rendererLayout, fullCategoryWidth, dotRadius }
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
      drawBeeswarmPoints(ctx, rendererLayout, geom.dotRadius)
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
    const hovered = plot.hover.data
    if (hovered === null) return
    const { barIndex: hoveredBarIndex, valuePx: mouseValuePx } = hovered
    const item = geom.rendererLayout.items[hoveredBarIndex]
    if (!item) return
    const { x: plotLeft, y: plotTop, width: plotWidth, height: plotHeight } = frame
    const halfCat = item.categoryWidth / 2

    if (isVertical) {
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

  function pushStats(content: FrameHit['content'], stats: CategoryDistribution['stats']) {
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
      { key: itemTooltipKey, value: dataItem.label },
      { key: 'Value', value: fmt(mouseValue) },
    ]

    // Dot radius is computed once in `geom` (stable between full renders), not
    // re-derived here — this hit-test runs at frame rate during hover.
    const tolerance = geom.dotRadius
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
      tooltipId: 'beeswarm-crosshair',
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
  aria-label={ariaLabel}
></canvas>
