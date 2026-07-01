<script lang="ts">
  import {
    alignToPixelCenter,
    getTooltipPosition,
  } from '$lib/plots/shared/canvasUtils'
  import {
    computeGroupedLegendGeometry,
    drawLegend,
    drawLegendGroupTitles,
    drawPlotArea,
    drawXAxisLabel,
    getLegendTooltipContent,
    getLegendTooltipPosition,
    hitTestLegend,
    niceTimelineTicks,
    SCARF_LEGEND_CONFIG,
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    FONT_PRIMARY,
    type BlockedRegion,
    type CanvasExportProps,
    type FramePointer,
    type FrameDrag,
    type LegendGeometry,
    type LegendGroup,
    type LegendItemGeometry,
    getXAxisHeight,
    getXAxisLabelOffset,
    maxAxisTitleHeight,
    PLOT_LEGEND_GAP,
  } from '$lib/plots/shared'
  import { onDestroy } from 'svelte'
  import { measureTextHeight } from '$lib/shared/utils/textUtils'
  import { SCARF_LAYOUT } from '../const'
  import { FIXATION_CATEGORY_ID } from '$lib/data/types'
  import { SEGMENT_STRIDE, SegmentField } from '$lib/data/binary/schema'
  import {
    calculateEffectiveMarginTop,
    calculateIntrinsicContentHeight,
    calculateIsCompactMode,
    calculateLegendStructuralHeight,
    calculateLeftLabelWidth,
    calculateOverlayLayout,
    calculateOverlayMinRowPitch,
    calculatePlotLayout,
    getScarfIdentifierSystem,
    getXAxisLabel,
  } from '../core/layout'
  import {
    calculateHighlightMask,
    createStyleArrays,
    mapDataToLegendGroups,
  } from '../core/transformer'
  import {
    drawScarfBands,
    drawScarfGrid,
    drawScarfHighlightMarkers,
    drawScarfLabels,
    type ScarfLayoutContext,
  } from '../core/renderer'
  import type { ScarfData, ScarfPlotSettings } from '../types'

  // `width`/`height` are the standard total-canvas sizing props (CanvasExportProps),
  // matching every other figure — the on-screen grid cell or the export dimensions.
  interface Props extends CanvasExportProps {
    data: ScarfData
    settings: ScarfPlotSettings
    highlights: string[]
    onLegendClick: (identifier: string) => void
    onTooltipActivation: (args: {
      segmentOrderId: number
      participantId: number
      x: number
      y: number
    }) => void
    onTooltipDeactivation: () => void
    onDragStepX?: (stepChange: number) => void
    onDragEnd?: () => void
  }

  let {
    data,
    settings,
    highlights = [],
    onLegendClick = () => {},
    onTooltipActivation = () => {},
    onTooltipDeactivation = () => {},
    onDragStepX = () => {},
    onDragEnd = () => {},
    width = 0,
    height,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  const HIGHLIGHT_COLOR = '#007acc'
  const HIGHLIGHT_FILL_ALPHA = 0.2
  const HIGHLIGHT_DASH: number[] = [2, 2]
  const INTERNAL_PADDING_TOP = 6
  const INTERNAL_PADDING_BOTTOM = 0

  const isOverlayMode = $derived(data.isOverlay)

  const xAxisLabel = $derived(
    getXAxisLabel(
      settings.timeline,
      settings.timelineStart,
      settings.timelineEnd,
      settings.ordinalStart,
      settings.ordinalEnd
    )
  )
  const legendHeight = $derived(
    calculateLegendStructuralHeight(data.legendData?.groups ?? [], width)
  )

  const tickLabelHeight = $derived.by(() => {
    let maxHeight = 0
    const ticks = niceTimelineTicks(data.timeline).labels || []
    for (const t of ticks) {
      const h = measureTextHeight(t, FONT_PRIMARY.SIZE, FONT_PRIMARY.FAMILY)
      if (h > maxHeight) maxHeight = h
    }
    return maxHeight
  })
  // Reserve the worst-case (2-line) x-title height — the plot width the title
  // wraps to depends on the left-label width, which depends (via compact mode →
  // plot height → bottom margin) back on this height, so it can't be wrapped
  // exactly here without a cycle. The draw still wraps to the real width.
  const axisTitleHeight = $derived(xAxisLabel ? maxAxisTitleHeight(FONT_PRIMARY.SIZE) : 0)
  const xAxisHeight = $derived(
    xAxisLabel ? getXAxisHeight(tickLabelHeight, axisTitleHeight, 10) : 10 + tickLabelHeight
  )
  const xAxisLabelOffset = $derived(getXAxisLabelOffset(tickLabelHeight, 10))

  const fixedOverheadAbove = $derived(margins.top + INTERNAL_PADDING_TOP)
  const fixedOverheadBelow = $derived.by(() => {
    const legendSpace = legendHeight > 0 ? PLOT_LEGEND_GAP + legendHeight : 0
    return xAxisHeight + legendSpace + margins.bottom + INTERNAL_PADDING_BOTTOM
  })
  const netAvailableHeight = $derived(
    Math.max(1, height - fixedOverheadAbove - fixedOverheadBelow)
  )

  const layout = $derived.by(() => {
    const count = data.participants.length
    if (isOverlayMode) {
      return calculateOverlayLayout(count, data.eventZoneConcurrency ?? 0, netAvailableHeight)
    }
    const compact = calculateIsCompactMode(count, netAvailableHeight)
    const base = calculatePlotLayout(count, netAvailableHeight, compact)
    return {
      ...base,
      eventLaneHeight: 0,
      eventZoneHeight: 0,
      eventBandTop: 0,
    }
  })
  const isCompactMode = $derived(layout.isCompact)

  const participantLabels = $derived.by(() =>
    isCompactMode ? [] : data.participants.map(p => p.label)
  )
  const LEFT_LABEL_WIDTH = $derived(calculateLeftLabelWidth(isCompactMode, participantLabels))

  const plotAreaWidth = $derived(
    Math.max(
      0,
      width - margins.left - margins.right - LEFT_LABEL_WIDTH - SCARF_LAYOUT.RIGHT_MARGIN
    )
  )

  const participantBarsHeight = $derived(
    data.participants.length * layout.heightOfBarWrap
  )
  const legendY = $derived(
    participantBarsHeight + xAxisHeight + (legendHeight > 0 ? PLOT_LEGEND_GAP : 0)
  )

  // Hover state
  let hoveredRowIndex = $state<number | null>(null)
  let mouseXPx = $state<number | null>(null)
  let hoveredLegendItem = $state<LegendItemGeometry | null>(null)
  let currentHoveredSegment = $state<{ participantId: string | number; orderId: number } | null>(null)
  // Pointer/drag scratch (not reactive — read only inside pointer callbacks)
  let canDrag = false
  let dragActive = false
  let lastDragX = 0

  const totalWidth = $derived(width)
  const totalHeight = $derived(height)
  const usedHighlights = $derived(highlights)

  const plot = usePlot({
    width: () => totalWidth,
    height: () => totalHeight,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [
      data, settings, totalWidth, totalHeight, highlights, usedHighlights,
      width, height, dpiOverride,
      margins.left, margins.right, effectiveMarginTop, margins.bottom,
    ],
    placeholder: () => (canRender ? null : 'Increase height to view plot'),
    gutters: () => ({}),
    clipData: false,
    drawData: renderScarf,
    drawOverlay: drawScarfOverlay,
    blockedRegions: () => blockedRegions,
    pointer: {
      onMove: handleHover,
      onDown: handlePointerDown,
      onDrag: handlePointerDrag,
      onUp: handlePointerUp,
      dragThreshold: 5,
    },
  })

  const legendGroups: LegendGroup[] = $derived(
    mapDataToLegendGroups(data.legendData?.groups ?? [])
  )

  const intrinsicContentHeight = $derived(
    calculateIntrinsicContentHeight(
      legendHeight, legendY, xAxisHeight, participantBarsHeight, INTERNAL_PADDING_BOTTOM
    )
  )

  const effectiveMarginTop = $derived(
    calculateEffectiveMarginTop(
      height, intrinsicContentHeight, margins.top, margins.bottom, INTERNAL_PADDING_TOP
    )
  )

  const legendGeometry: LegendGeometry = $derived.by(() => {
    if (legendGroups.length === 0) {
      return { items: [], height: 0, groupTitles: [], totalHeight: 0, itemsPerRow: 3 }
    }
    return computeGroupedLegendGeometry(
      legendGroups,
      SCARF_LEGEND_CONFIG,
      margins.left,
      legendY + effectiveMarginTop,
      width
    )
  })

  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    const pad = Math.ceil(SCARF_LEGEND_CONFIG.itemSpacing / 2)
    const regions: BlockedRegion[] = [
      {
        x: LEFT_LABEL_WIDTH + margins.left,
        y: effectiveMarginTop,
        w: plotAreaWidth,
        h: participantBarsHeight,
      },
    ]
    for (const item of legendGeometry.items) {
      regions.push({
        x: item.x - pad,
        y: item.y - pad,
        w: item.width + pad * 2,
        h: SCARF_LEGEND_CONFIG.itemHeight + pad * 2,
      })
    }
    return regions
  })

  const identifierSystem = $derived.by(() => {
    if (!data.stylingAndLegend)
      return { idToIndex: new Map(), indexToId: new Map(), idToType: new Map(), totalIdentifiers: 0 }
    return getScarfIdentifierSystem(
      data.stylingAndLegend.aoi.map(i => i.identifier),
      data.stylingAndLegend.category.map(i => i.identifier),
      data.stylingAndLegend.visibility.map(i => i.identifier)
    )
  })

  const rectStyleMap = $derived.by(() => {
    const map = new Map()
    if (!data.stylingAndLegend) return map
    for (const style of [...data.stylingAndLegend.aoi, ...data.stylingAndLegend.category]) {
      const baseStyle = { fill: style.color }
      map.set(style.identifier, { normal: baseStyle, dimmed: { ...baseStyle, opacity: 0.15 } })
    }
    return map
  })

  const eventStyleMap = $derived.by(() => {
    const map = new Map()
    if (!data.stylingAndLegend) return map
    for (const style of data.stylingAndLegend.visibility) {
      const baseStyle = { fill: style.color, stroke: style.color, strokeWidth: 1 }
      map.set(style.identifier, { normal: baseStyle, dimmed: { ...baseStyle, opacity: 0.15 } })
    }
    return map
  })

  const highlightMaskByIndex = $derived(calculateHighlightMask(usedHighlights, identifierSystem))

  const canRender = $derived.by(() => {
    const count = data.participants.length
    if (isOverlayMode) {
      const minPitch = calculateOverlayMinRowPitch(data.eventZoneConcurrency ?? 0)
      return netAvailableHeight >= Math.max(count * minPitch, SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT)
    }
    const minPlotHeight = isCompactMode
      ? Math.max(count * SCARF_LAYOUT.MIN_BAR_HEIGHT, SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT)
      : SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT
    return netAvailableHeight >= minPlotHeight
  })

  const visualEventBuckets = $derived(data.visualEventBuckets)
  const styleArrays = $derived(
    createStyleArrays(
      identifierSystem, rectStyleMap, eventStyleMap,
      // One rect style per identifier (the gaze render resolves styleIdx inline);
      // rect buckets no longer exist, so size from the identifier system.
      identifierSystem.indexToId.size, visualEventBuckets.length
    )
  )
  const rectStyleArray = $derived(styleArrays.rectStyles)
  const eventStyleArray = $derived(styleArrays.eventStyles)

  function renderScarf(ctx: CanvasRenderingContext2D) {
    const scarfPlotLeft = Math.floor(LEFT_LABEL_WIDTH + margins.left)
    const scarfPlotWidth = Math.floor(plotAreaWidth)

    const renderCtx: ScarfLayoutContext = {
      heightOfBar: layout.heightOfBar,
      spaceAboveRect: layout.spaceAboveRect,
      nonFixationHeight: layout.nonFixationHeight,
      heightOfBarWrap: layout.heightOfBarWrap,
      scaleFactor: layout.scaleFactor,
      isCompact: layout.isCompact,
      leftLabelWidth: LEFT_LABEL_WIDTH,
      plotAreaWidth,
      effectiveMarginTop,
      participantBarsHeight,
      totalWidth,
      marginLeft: margins.left,
      eventLaneHeight: layout.eventLaneHeight,
      eventZoneHeight: layout.eventZoneHeight,
      eventBandTop: layout.eventBandTop,
      isOverlay: isOverlayMode,
      deviceScale: plot.canvasState.pixelRatio ?? 1,
    }

    drawScarfLabels(ctx, data, renderCtx)
    drawScarfGrid(ctx, data, renderCtx)

    drawScarfBands(
      ctx,
      data,
      renderCtx,
      rectStyleArray,
      eventStyleArray,
      highlightMaskByIndex
    )

    drawScarfHighlightMarkers(ctx, data, renderCtx, {
      rectStyleArray,
      highlightMask: highlightMaskByIndex,
    })

    const scarfXTicks = niceTimelineTicks(data.timeline)
    drawPlotArea(ctx, {
      x: scarfPlotLeft,
      y: effectiveMarginTop,
      width: scarfPlotWidth,
      height: participantBarsHeight,
      ticks: { bottom: scarfXTicks, top: { positions: scarfXTicks.positions } },
    })
    drawXAxisLabel(
      ctx, xAxisLabel, scarfPlotLeft, scarfPlotWidth,
      participantBarsHeight + effectiveMarginTop, xAxisLabelOffset
    )

    drawLegendGroupTitles(ctx, legendGeometry, SCARF_LEGEND_CONFIG)
    drawLegend(ctx, legendGeometry, SCARF_LEGEND_CONFIG, usedHighlights)
  }

  // Overlay layer: only the hover crosshair. Drawn on top of the cached data
  // layer so mouse-moves repaint via blit instead of re-running renderScarf.
  function drawScarfOverlay(ctx: CanvasRenderingContext2D) {
    drawCrosshairHighlight(
      ctx,
      Math.floor(LEFT_LABEL_WIDTH + margins.left),
      effectiveMarginTop,
      Math.floor(plotAreaWidth),
      participantBarsHeight,
      layout.heightOfBarWrap
    )
  }

  function drawCrosshairHighlight(
    ctx: CanvasRenderingContext2D,
    plotLeft: number, plotTop: number, plotWidth: number, plotHeight: number, rowHeight: number
  ) {
    if (hoveredRowIndex === null || mouseXPx === null) return
    const rowY = plotTop + hoveredRowIndex * rowHeight

    ctx.save()
    ctx.globalAlpha = HIGHLIGHT_FILL_ALPHA
    ctx.fillStyle = HIGHLIGHT_COLOR
    ctx.fillRect(plotLeft, rowY, plotWidth, rowHeight)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = HIGHLIGHT_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(HIGHLIGHT_DASH)
    ctx.beginPath()
    const topEdge = alignToPixelCenter(rowY)
    const bottomEdge = alignToPixelCenter(rowY + rowHeight)
    ctx.moveTo(plotLeft, topEdge)
    ctx.lineTo(plotLeft + plotWidth, topEdge)
    ctx.moveTo(plotLeft, bottomEdge)
    ctx.lineTo(plotLeft + plotWidth, bottomEdge)
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = HIGHLIGHT_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(HIGHLIGHT_DASH)
    ctx.beginPath()
    const x = alignToPixelCenter(mouseXPx)
    ctx.moveTo(x, plotTop)
    ctx.lineTo(x, plotTop + plotHeight)
    ctx.stroke()
    ctx.restore()
  }

  function isMouseOverLegendItem(mouseX: number, mouseY: number): LegendItemGeometry | null {
    if (!data.stylingAndLegend || !legendGeometry.items.length) return null
    return hitTestLegend(legendGeometry, SCARF_LEGEND_CONFIG, mouseX, mouseY)
  }

  function inPlotArea(mx: number, my: number): boolean {
    return (
      mx >= LEFT_LABEL_WIDTH + margins.left &&
      mx <= LEFT_LABEL_WIDTH + plotAreaWidth + margins.left &&
      my >= effectiveMarginTop &&
      my <= participantBarsHeight + effectiveMarginTop
    )
  }

  // ── Hover (via the frame's pointer.onMove) ──
  function handleHover(p: FramePointer) {
    const { x: mx, y: my, isOver } = p
    if (!isOver) {
      if (hoveredLegendItem) {
        hoveredLegendItem = null
        plot.hideTooltip(0)
      }
      if (hoveredRowIndex !== null || mouseXPx !== null) {
        hoveredRowIndex = null
        mouseXPx = null
        plot.scheduleOverlayRender()
      }
      if (currentHoveredSegment) {
        currentHoveredSegment = null
        onTooltipDeactivation()
      }
      plot.setCursor('default')
      return
    }

    const legendItem = isMouseOverLegendItem(mx, my)
    if (legendItem?.identifier !== hoveredLegendItem?.identifier) {
      if (legendItem) {
        hoveredLegendItem = legendItem
        const pos = getLegendTooltipPosition(legendItem, SCARF_LEGEND_CONFIG)
        plot.showTooltip(
          legendItem.identifier,
          getLegendTooltipContent(legendItem, usedHighlights.includes(legendItem.identifier)),
          pos.x,
          pos.y,
          { x: 0, y: 7 }
        )
      } else if (hoveredLegendItem) {
        hoveredLegendItem = null
        plot.hideTooltip(0)
      }
    }

    if (hoveredLegendItem) {
      plot.setCursor('pointer')
      if (hoveredRowIndex !== null) {
        hoveredRowIndex = null
        mouseXPx = null
        plot.scheduleOverlayRender()
      }
      return
    }

    if (!inPlotArea(mx, my)) {
      plot.setCursor('default')
      if (hoveredRowIndex !== null) {
        hoveredRowIndex = null
        mouseXPx = null
        plot.scheduleOverlayRender()
      }
      if (currentHoveredSegment) {
        currentHoveredSegment = null
        onTooltipDeactivation()
      }
      return
    }

    plot.setCursor('crosshair')

    const rowHeight = layout.heightOfBarWrap
    const newRowIndex = Math.floor((my - effectiveMarginTop) / rowHeight)
    hoveredRowIndex =
      newRowIndex >= 0 && newRowIndex < data.participants.length ? newRowIndex : null
    mouseXPx = mx
    plot.scheduleOverlayRender()

    const hoveredSegment =
      hoveredRowIndex !== null ? findSegmentAtRowAndTime(hoveredRowIndex, mx) : null

    if (
      hoveredSegment &&
      (!currentHoveredSegment ||
        hoveredSegment.participantId !== currentHoveredSegment.participantId ||
        hoveredSegment.orderId !== currentHoveredSegment.orderId)
    ) {
      currentHoveredSegment = {
        participantId: hoveredSegment.participantId,
        orderId: hoveredSegment.orderId,
      }
      const floorLeft = Math.floor(LEFT_LABEL_WIDTH + margins.left)
      const floorWidth = Math.floor(plotAreaWidth)
      const segEndX = floorLeft + (hoveredSegment.x + hoveredSegment.width) * floorWidth
      const rowBottomY = hoveredSegment.y * rowHeight + rowHeight + effectiveMarginTop
      const tooltipPos = getTooltipPosition(plot.canvasState, segEndX, rowBottomY, { x: 5, y: 5 })
      onTooltipActivation({
        segmentOrderId: hoveredSegment.orderId,
        participantId: hoveredSegment.participantId,
        x: tooltipPos.x,
        y: tooltipPos.y,
      })
    } else if (!hoveredSegment && currentHoveredSegment) {
      currentHoveredSegment = null
      onTooltipDeactivation()
    }
  }

  // ── Pointer / drag (via the frame's generic pointer lifecycle) ──
  function handlePointerDown(p: FramePointer) {
    const item = isMouseOverLegendItem(p.x, p.y)
    if (item) {
      onLegendClick(item.identifier)
      canDrag = false
      return
    }
    canDrag = inPlotArea(p.x, p.y)
    dragActive = false
    lastDragX = p.x
  }

  function handlePointerDrag(d: FrameDrag) {
    if (!canDrag) return
    if (isMouseOverLegendItem(d.x, d.y)) {
      canDrag = false
      return
    }
    const inc = d.x - lastDragX
    if (Math.abs(inc) > 1) {
      dragActive = true
      onDragStepX(inc)
      lastDragX = d.x
    }
  }

  function handlePointerUp(_p: FramePointer & { dragged: boolean }) {
    if (dragActive) onDragEnd()
    canDrag = false
    dragActive = false
  }

  function findSegmentAtRowAndTime(rowIndex: number, mouseX: number) {
    const { indexToId } = identifierSystem
    const scale = layout.scaleFactor
    const floorLeft = Math.floor(LEFT_LABEL_WIDTH + margins.left)
    const floorWidth = Math.floor(plotAreaWidth)

    // Scan the row's binary segments directly (no rect buckets), resolving
    // AOI/category inline. Segments in a row are time-disjoint, so at most one
    // contains mouseX; a multi-AOI fixation's topmost sub-rect wins.
    if (data.gazeSource) {
      const gs = data.gazeSource
      if (rowIndex < 0 || rowIndex >= gs.participantIds.length) return null
      const HNF = SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT
      const HBAR = SCARF_LAYOUT.HEIGHT_BAR_DEFAULT
      const SAR = SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT
      const segBuf = gs.reader.segmentBufferRaw
      const clipMin = gs.projClipMin[rowIndex]
      const clipMax = gs.projClipMax[rowIndex]
      const pScale = gs.projScale[rowIndex]
      const pid = gs.participantIds[rowIndex]
      const overlap = new Uint16Array(Math.max(64, gs.aoiOrderMap.length))
      const { startIndex, endIndex } = gs.reader.getSegmentRange(gs.stimulusId, pid)

      const build = (styleIdx: number, hOrig: number, internalYDefault: number, orderId: number, xN: number, wN: number) => {
        let rectH = hOrig
        let internalY = internalYDefault
        if (scale !== 1) {
          if (hOrig === HNF) {
            rectH = layout.nonFixationHeight
            internalY = layout.spaceAboveRect + (layout.heightOfBar - layout.nonFixationHeight) / 2
          } else {
            rectH = hOrig * scale
            internalY = layout.spaceAboveRect + (internalYDefault - SAR) * scale
          }
        }
        return {
          x: xN,
          y: rowIndex,
          width: wN,
          height: rectH,
          internalY,
          identifier: indexToId.get(styleIdx) ?? '',
          participantId: data.participants[rowIndex]?.id ?? rowIndex,
          segmentId: orderId,
          orderId,
        }
      }

      let hit: ReturnType<typeof build> | null = null
      for (let i = startIndex; i < endIndex; i++) {
        const localId = i - startIndex
        const segBase = i * SEGMENT_STRIDE
        const categoryId = segBuf[segBase + SegmentField.CATEGORY_ID] | 0
        let start = gs.isOrdinal ? localId : segBuf[segBase + SegmentField.START_TIME]
        let end = gs.isOrdinal ? localId + 1 : segBuf[segBase + SegmentField.END_TIME]
        if (end <= clipMin || start >= clipMax) continue
        start = Math.max(clipMin, start)
        end = Math.min(clipMax, end)
        const xN = (start - clipMin) * pScale
        const wN = (end - start) * pScale
        const pxX = floorLeft + xN * floorWidth
        const pxW = wN * floorWidth
        if (mouseX < pxX || mouseX > pxX + pxW) continue

        if (categoryId !== FIXATION_CATEGORY_ID) {
          if (gs.hideNonFixations || gs.hiddenCategoryIds.has(categoryId)) continue
          const sIdx =
            categoryId >= 0 && categoryId < gs.categoryStyleIdxMap.length
              ? gs.categoryStyleIdxMap[categoryId]
              : -1
          if (sIdx === -1) continue
          hit = build(sIdx, HNF, SAR + (HBAR - HNF) * 0.5, localId, xN, wN)
        } else {
          const count = gs.aoiGroupReader.getSegmentAoisUniqueDirect(i, gs.stimulusId, overlap)
          if (count === 0) {
            hit = build(gs.noAoiStyleIdx, HBAR, SAR, localId, xN, wN)
          } else {
            const h = HBAR / count
            for (let idx = 0; idx < count; idx++) {
              const sIdx = gs.aoiOrderMap[overlap[idx]]
              if (sIdx < 0) continue
              hit = build(sIdx, h, SAR + idx * h, localId, xN, wN) // topmost = last
            }
          }
        }
      }
      return hit
    }

    return null
  }

  onDestroy(() => {
    if (hoveredLegendItem) plot.hideTooltip(0)
  })
</script>

<canvas
  class="scarf-plot-figure"
  style:pointer-events={canRender ? 'auto' : 'none'}
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  data-component="scarfplot"
  aria-label="Scarf plot visualization"
></canvas>
