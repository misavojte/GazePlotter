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
    drawCategoryDelimiters,
    drawSwarmPoints,
    drawProportionalBars,
    drawStatisticalOverlay,
    DOT_PITCH,
    DOT_RADIUS,
    valueToPixel,
    type BeeswarmLayout,
  } from './renderers'

  const MARGIN_RIGHT = 20
  const TICK_LENGTH = 5
  /**
   * How many dot-widths a row must be able to hold before the figure is willing to
   * draw it. Below this the band is barely thicker than the marks, every value
   * lands on or beside the centre line, and the swarm cannot say anything.
   *
   * Replaces a 12px minimum row plus a 4px inter-row gap plus 20px of padding at
   * each end. That arithmetic described a layout this figure does not use: rows are
   * laid out as `availableSpace / rowCount` with no gaps and no end padding, so the
   * guard was measuring something other than the thing it guarded. Expressed in
   * dot-widths it tracks the mark automatically. Slightly more permissive at small
   * row counts than the old numbers were.
   */
  const MIN_ROW_DOT_WIDTHS = 4
  const LABEL_FONT_SIZE = FONT_PRIMARY.SIZE
  const CATEGORY_LABEL_GAP = 6

  interface Props extends CanvasExportProps {
    data: CategoryDistribution[]
    timeline: AdaptiveTimeline
    axisLabel: string
    orientation: 'horizontal' | 'vertical'
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

  // A plain right margin. This used to reserve extra room for a value label at the
  // end of each bar, sized from the digits of the largest value, but no such label
  // is drawn anywhere in this figure: the only text it renders is the row label in
  // the left gutter. The reservation therefore just took 10 to 25px of plot width
  // away, more as the values grew more digits.
  const rightChrome = $derived(MARGIN_RIGHT)

  const plot = usePlot<{ rowIndex: number; valuePx: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, timeline, axisLabel, orientation, statisticalOverlay, noMetric, proportion],
    placeholder: () => (noMetric ? METRIC_MISSING_MESSAGE : null),
    fit: frame => {
      if (data.length === 0) return null
      const availableSpace = isVertical ? frame.width : frame.height
      const rowThickness = availableSpace / data.length
      if (rowThickness >= MIN_ROW_DOT_WIDTHS * DOT_PITCH) return null
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
    drawData: drawUnderlay,
    clipData: false, // data layers self-clip; category labels live in the gutter
    drawAboveAxes: drawMarks,
    axes: () => {
      const labelled = valueAxisTicks(timeline, { invert: isVertical })
      const mirror = valueAxisTicks(timeline, { invert: isVertical, ticksOnly: true })
      return isVertical
        ? { left: { ticks: labelled, title: axisLabel }, right: { ticks: mirror } }
        : { bottom: { ticks: labelled, title: axisLabel }, top: { ticks: mirror } }
    },
    drawOverlay: drawCrosshairHighlight,
    hitTest: computeHit,
    hoverKey: d => d.rowIndex,
    onHover: d => onDataHover(d ? data[d.rowIndex] : null),
  })

  // --- Geometry derived from the resolved data rect ---
  const geom = $derived.by(() => {
    const f = plot.frame
    const plotW = f.width
    const plotH = f.height
    const availableSpace = isVertical ? plotW : plotH

    // Slot width is all the geometry this mark needs. Everything else that used
    // to be computed here — a per-item bar width, a spacing cap, a start offset,
    // a value scaler — fed the bar rectangles that nothing read, so the whole
    // chain went with them. That also retires the barWidth and barSpacing props:
    // the swarm derives its spacing from the dot size instead.
    const fullCategoryWidth = data.length > 0 ? availableSpace / data.length : 0

    // Slots only. The per-item bar rectangles that used to be built here were
    // never read: their indices were taken and the geometry discarded. The
    // proportional-bar path derives its own rects from these slots.
    const items = data.map((item, index) => ({
      categoryCenter: (isVertical ? f.x : f.y) + (index + 0.5) * fullCategoryWidth,
      categoryWidth: fullCategoryWidth,
      data: item,
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

    // A constant now, so there is nothing to derive. It stays on `geom` only
    // because the per-frame hit-test uses it as its hover tolerance.
    return { rendererLayout, fullCategoryWidth }
  })

  /**
   * Everything that belongs UNDER the axis chrome: the plot ground, the row
   * delimiters, and the proportional bars when the metric is a rate. The swarm and
   * its summary are drawn over the chrome instead, in `drawMarks`.
   */
  function drawUnderlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const { rendererLayout } = geom

    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.width, frame.height)
    ctx.clip()
    fillPlotAreaBackground(ctx, frame.x, frame.y, frame.width, frame.height, 'white')
    drawCategoryDelimiters(ctx, rendererLayout)
    if (proportion) {
      // Proportion metrics (e.g. noticed-rate): a plain proportional bar,
      // never a swarm of 0/1 dots. A bar grows from the baseline, so it has no
      // reason to overhang and stays in the tight clip.
      drawProportionalBars(ctx, rendererLayout)
    }
    ctx.restore()

    drawCategoryLabels(ctx, frame)
  }

  /**
   * The swarm and its summary, drawn OVER the axis chrome. `drawPlotArea` strokes
   * the plot border last, so drawing these with the rest of the data would let
   * that border slice through any dot sitting on the axis minimum or maximum.
   */
  function drawMarks(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (proportion) return
    const { rendererLayout } = geom

    // The dots get a clip widened by one radius ALONG THE VALUE AXIS, so a value
    // sitting on the axis minimum or maximum draws as a whole circle rather than a
    // half one. Only that axis: in the category direction the swarm's spread is
    // bounded by its slot, which already leaves the outermost dot a full radius
    // inside, and the gutters on the value axis are far wider than a radius.
    ctx.save()
    ctx.beginPath()
    if (isVertical) {
      ctx.rect(frame.x, frame.y - DOT_RADIUS, frame.width, frame.height + DOT_RADIUS * 2)
    } else {
      ctx.rect(frame.x - DOT_RADIUS, frame.y, frame.width + DOT_RADIUS * 2, frame.height)
    }
    ctx.clip()
    // No shaded background band any more: it sat behind the dots, so it was
    // invisible where the swarm is dense and covered dots where it is not.
    drawSwarmPoints(ctx, rendererLayout)
    ctx.restore()

    // The summary keeps the tight clip. An SD whisker or a CI arm that runs past
    // the axis is cut at the border, because a statistic reaching outside the plot
    // would claim a range the axis does not show.
    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.width, frame.height)
    ctx.clip()
    drawStatisticalOverlay(ctx, rendererLayout, statisticalOverlay)
    ctx.restore()
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
    const { rowIndex: hoveredRowIndex, valuePx: mouseValuePx } = hovered
    const item = geom.rendererLayout.items[hoveredRowIndex]
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

  function computeHit(x: number, y: number, frame: PlotFrame): FrameHit<{ rowIndex: number; valuePx: number }> | null {
    const layout = geom.rendererLayout
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

    const dataItem = data[rowIndex]
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
    // The cursor counts as being on a dot when it is within the dot, so the
    // tolerance IS the radius.
    const tolerance = proportion ? 0 : DOT_RADIUS
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
      data: { rowIndex, valuePx },
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  aria-label={ariaLabel}
></canvas>
