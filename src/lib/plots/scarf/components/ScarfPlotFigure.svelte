<script lang="ts">
  import {
    alignToPixelCenter,
    markCrosshairStrip,
    strokeCrosshairGuides,
  } from '$lib/plots/shared/canvasUtils'
  import {
    computeGroupedLegendGeometry,
    drawLegend,
    drawLegendGroupTitles,
    hitTestLegend,
    niceTimelineTicks,
    SCARF_LEGEND_CONFIG,
    usePlot,
    canvasBlockSelect,
    type BlockedRegion,
    type CanvasExportProps,
    type FrameHit,
    type FramePointer,
    type FrameDrag,
    type LegendGeometry,
    type LegendGroup,
    type LegendItemGeometry,
    type PlotFrame,
    type FrameGutters,
    type PlotPlaceholderContent,
    PLOT_LEGEND_GAP,
    cannotFitPlaceholder,
    resolveFrameLayout,
  } from '$lib/plots/shared'
  import {
    cursorRows,
    drawTimeGuide,
    timeAtX,
    timeGuideX,
    type PlotCursorPort,
  } from '$lib/plots/shared/plotCursor.svelte'
  import { onDestroy } from 'svelte'
  import { SCARF_LAYOUT } from '../const'
  import { FIXATION_CATEGORY_ID } from '$lib/data/types'
  import { SEGMENT_STRIDE, SegmentField } from '$lib/data/binary/schema'
  import {
    calculateIsCompactMode,
    calculateLegendStructuralHeight,
    calculateLeftLabelWidth,
    calculateOverlayLayout,
    calculateOverlayMinRowPitch,
    calculatePlotLayout,
    getScarfIdentifierSystem,
    getXAxisLabel,
    scarfFrameGutters,
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
    /** Builds segment-tooltip content (screen-only; export renders without). */
    getTooltipContent?: (
      participantId: number,
      segmentOrderId: number
    ) => Array<{ key: string; value: string }>
    onDragStepX?: (stepChange: number, width: number) => void
    onDragEnd?: () => void
    /** Shared PLOT CURSOR (screen-only; export renders without one). */
    plotCursor?: PlotCursorPort | null
  }

  let {
    data,
    settings,
    highlights = [],
    onLegendClick = () => {},
    getTooltipContent = () => [],
    onDragStepX = () => {},
    onDragEnd = () => {},
    plotCursor = null,
    width = 0,
    height,
    margin = 0,
  }: Props = $props()

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
  /** Legend block reserved at the bottom, gap folded in (the resolver abuts the
   *  block straight to the x-axis gutter). */
  const legendSpace = $derived(legendHeight > 0 ? PLOT_LEGEND_GAP + legendHeight : 0)

  const xAxisTicks = $derived(niceTimelineTicks(data.timeline))

  const guttersFor = (leftLabelWidth: number): FrameGutters =>
    scarfFrameGutters({
      tickLabels: xAxisTicks.labels ?? [],
      axisTitle: xAxisLabel,
      leftLabelWidth,
      legendSpace,
    })

  // ── The row band: the ONE height the scarf's layout reads ──
  // It cannot be `plot.frame.height`, because compact mode decides the left label
  // gutter and would close a loop: pad.left ← isCompact ← row band ← bottom
  // gutter ← the plot width the resolver wraps the axis title to ← pad.left.
  // So the band asks the SAME resolver over the same declaration, with the left
  // inset pinned at its cap: independent of compact mode, and the narrowest plot
  // the scarf can have, so the title wraps to its tallest and the band is never
  // taller than the frame the figure ends up drawing in.
  // LOAD-BEARING: reading frame.height here cycles the derived graph.
  const rowBandHeight = $derived.by(() => {
    const { rect } = resolveFrameLayout(guttersFor(SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH), {
      left: 0,
      top: 0,
      right: plot.plotAreaWidth,
      bottom: plot.plotAreaHeight,
    })
    return Math.max(1, rect.height)
  })

  const layout = $derived.by(() => {
    const count = data.participants.length
    if (isOverlayMode) {
      return calculateOverlayLayout(count, data.eventZoneConcurrency ?? 0, rowBandHeight)
    }
    const compact = calculateIsCompactMode(count, rowBandHeight)
    const base = calculatePlotLayout(count, rowBandHeight, compact)
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
  /** Row order for the PLOT CURSOR — rebuilt on a data change, not per frame. */
  const participantIds = $derived(data.participants.map(p => p.id))
  const LEFT_LABEL_WIDTH = $derived(calculateLeftLabelWidth(isCompactMode, participantLabels))

  const participantBarsHeight = $derived(
    data.participants.length * layout.heightOfBarWrap
  )

  /** Harness hover payload: crosshair row + mouse x (canvas px). */
  type ScarfHover = { row: number; x: number }

  const plot = usePlot<ScarfHover>({
    width: () => width,
    height: () => height,
    margin: () => margin,
    // Every input to the resolved frame and to `plotTop` is already listed here
    // (they derive from data/settings and the canvas box), so neither is a dep in
    // its own right — and referencing one would make `plot`'s options depend on
    // `plot`'s own type.
    deps: () => [data, settings, highlights],
    // The verdict is about the row band (see `rowBandHeight`), which the scarf
    // measures itself to keep the left gutter out of a cycle — hence the unused
    // frame argument. It is still a fit guard, not a data placeholder: it turns
    // on and off with the canvas size.
    fit: (): PlotPlaceholderContent | null => placeholderMessage,
    // Same declaration the row band probes, with the real label column: so
    // `frame.x`/`frame.width` ARE the scarf's plot columns, and the resolver owns
    // the x-axis gutter and the legend block. Only the vertical placement stays
    // scarf-owned (see `plotTop`).
    // (Return type annotated: the declaration reads values that derive from the
    // handle's own geometry, so inferring it would chase `plot` through itself.)
    gutters: (): FrameGutters => guttersFor(LEFT_LABEL_WIDTH),
    axes: () => ({
      bottom: { title: xAxisLabel, ticks: xAxisTicks },
    }),
    clipData: false,
    drawData: renderScarf,
    drawOverlay: drawScarfOverlay,
    legend: {
      geometry: () => (data.stylingAndLegend ? legendGeometry : null),
      config: SCARF_LEGEND_CONFIG,
      highlights: () => highlights,
    },
    hitTest: plotHitTest,
    // The track-only hit covers empty timeline too, so the cursor follows the
    // pointer across gaps. Published as live reads of the hovered PIXEL and ROW, so a
    // drag-pan or an undo under a resting pointer re-derives the time.
    onHover: hover =>
      plotCursor?.publish(
        hover
          ? {
              time: () => timeAtX(rowBand, data.timeline, hover.x),
              // Slice, not index: an undo that narrows the participants under a
              // resting pointer must read back EMPTY, never throw into a sibling.
              participants: () => participantIds.slice(hover.row, hover.row + 1),
            }
          : null
      ),
    // Return type annotated, same cycle as `gutters`. The rows KEY, not the array:
    // moving within one row must not repaint every sibling.
    overlayDeps: (): string => `${cursorX}:${cursorRowsKey}`,
    blockedRegions: (): BlockedRegion[] => blockedRegions,
    pointer: {
      onDown: handlePointerDown,
      onDrag: handlePointerDrag,
      onUp: handlePointerUp,
      dragThreshold: 5,
    },
  })

  const legendGroups: LegendGroup[] = $derived(
    mapDataToLegendGroups(data.legendData?.groups ?? [])
  )

  // ── Vertical placement ──
  // Top-anchored at frame.y matching standard row/heatmap visualizations.
  const plotTop = $derived(plot.frame.y)
  const legendTop = $derived(plot.frame.legendY + PLOT_LEGEND_GAP)

  const legendGeometry: LegendGeometry = $derived.by(() => {
    if (legendGroups.length === 0) {
      return { items: [], height: 0, groupTitles: [], totalHeight: 0, itemsPerRow: 3 }
    }
    return computeGroupedLegendGeometry(
      legendGroups,
      SCARF_LEGEND_CONFIG,
      margin,
      legendTop,
      width
    )
  })

  // The rows, not the frame's full band — the frame includes centring slack the
  // marks never fill. One source for the blocked region, the time guide and the PLOT CURSOR
  // mark, so a guide can never hang below the last row.
  const rowBand = $derived({
    x: plot.frame.x,
    y: plotTop,
    width: plot.frame.width,
    height: participantBarsHeight,
  })

  // The legend items' blocked rects come from the harness legend band.
  const blockedRegions = $derived.by<BlockedRegion[]>(() => [
    { x: rowBand.x, y: rowBand.y, w: rowBand.width, h: rowBand.height },
  ])

  const cursorX = $derived(
    timeGuideX(rowBand, data.timeline, plotCursor?.time ?? null)
  )
  const cursorRowIndices = $derived(
    cursorRows(participantIds, plotCursor?.participants ?? [])
  )
  const cursorRowsKey = $derived(cursorRowIndices.join(','))

  const identifierSystem = $derived.by(() => {
    if (!data.stylingAndLegend)
      return { idToIndex: new Map(), indexToId: new Map(), idToType: new Map(), totalIdentifiers: 0 }
    return getScarfIdentifierSystem(
      data.stylingAndLegend.aoi.map(i => i.identifier),
      data.stylingAndLegend.category.map(i => i.identifier),
      data.stylingAndLegend.event.map(i => i.identifier)
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
    for (const style of data.stylingAndLegend.event) {
      const baseStyle = { fill: style.color, stroke: style.color, strokeWidth: 1 }
      map.set(style.identifier, { normal: baseStyle, dimmed: { ...baseStyle, opacity: 0.15 } })
    }
    return map
  })

  const highlightMaskByIndex = $derived(calculateHighlightMask(highlights, identifierSystem))

  const canRender = $derived.by(() => {
    const count = data.participants.length
    if (isOverlayMode) {
      const minPitch = calculateOverlayMinRowPitch(data.eventZoneConcurrency ?? 0)
      return rowBandHeight >= Math.max(count * minPitch, SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT)
    }
    const minPlotHeight = isCompactMode
      ? Math.max(count * SCARF_LAYOUT.MIN_BAR_HEIGHT, SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT)
      : SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT
    return rowBandHeight >= minPlotHeight
  })

  const placeholderMessage = $derived.by(() => {
    if (canRender) return null

    const hasEvents = data.isOverlay || (data.visualEventBuckets && data.visualEventBuckets.some(b => b.length > 0)) || (data.eventZoneConcurrency ?? 0) > 0
    const hasNonFixations = data.stylingAndLegend?.category && data.stylingAndLegend.category.length > 0

    const extraSteps: string[] = []
    if (hasEvents) {
      extraSteps.push('Set Plot Settings > Events to None')
    }
    if (hasNonFixations) {
      extraSteps.push(
        'Pick a narrower selection in Plot Settings > Eye-movement Types'
      )
    }

    return cannotFitPlaceholder('height', extraSteps)
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

  function renderScarf(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const renderCtx: ScarfLayoutContext = {
      heightOfBar: layout.heightOfBar,
      spaceAboveRect: layout.spaceAboveRect,
      nonFixationHeight: layout.nonFixationHeight,
      heightOfBarWrap: layout.heightOfBarWrap,
      scaleFactor: layout.scaleFactor,
      isCompact: layout.isCompact,
      plotLeft: frame.x,
      plotWidth: frame.width,
      plotTop,
      participantBarsHeight,
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

    drawLegendGroupTitles(ctx, legendGeometry, SCARF_LEGEND_CONFIG)
    drawLegend(ctx, legendGeometry, SCARF_LEGEND_CONFIG, highlights)
  }

  // Overlay layer: the PLOT CURSOR's marks plus the local CROSSHAIR, drawn on top
  // of the cached data layer so mouse-moves repaint via blit instead of re-running
  // renderScarf. Both channels come first — they must survive the local-hover
  // early return.
  function drawScarfOverlay(ctx: CanvasRenderingContext2D) {
    drawTimeGuide(ctx, rowBand, cursorX)
    // The cursor's rows and the local hover row get the SAME mark: it says "this
    // participant", never who pointed at them. Only the EXTENT differs below —
    // a local hover also knows an instant, so it adds the vertical guide.
    for (const row of cursorRowIndices) markRow(ctx, row)
    const hover = plot.hover.data
    if (!hover) return
    markRow(ctx, hover.row)
    const x = alignToPixelCenter(hover.x)
    strokeCrosshairGuides(ctx, [x, rowBand.y, x, rowBand.y + rowBand.height])
  }

  const rowY = (row: number) => rowBand.y + row * layout.heightOfBarWrap

  const markRow = (ctx: CanvasRenderingContext2D, row: number) =>
    markCrosshairStrip(
      ctx, rowBand.x, rowY(row), rowBand.width, layout.heightOfBarWrap, 0.2, 'x'
    )

  function isMouseOverLegendItem(mouseX: number, mouseY: number): LegendItemGeometry | null {
    if (!data.stylingAndLegend || !legendGeometry.items.length) return null
    return hitTestLegend(legendGeometry, SCARF_LEGEND_CONFIG, mouseX, mouseY)
  }

  // The rows, not the frame's band: the harness gate (the frame rect) also covers
  // the centring slack above and below them, and the pointer handlers aren't
  // gated at all.
  function inPlotArea(mx: number, my: number): boolean {
    return (
      mx >= plot.frame.x &&
      mx <= plot.frame.right &&
      my >= plotTop &&
      my <= plotTop + participantBarsHeight
    )
  }

  // ── Hover (harness hitTest contract; the legend band is harness-owned —
  // it attaches no `data`, so a legend hover clears the crosshair) ──
  function plotHitTest(mx: number, my: number, frame: PlotFrame): FrameHit<ScarfHover> | null {
    if (!inPlotArea(mx, my)) return null
    const rowHeight = layout.heightOfBarWrap
    const row = Math.floor((my - plotTop) / rowHeight)
    if (row < 0 || row >= data.participants.length) return null

    const seg = findSegmentAtRowAndTime(row, mx, frame)
    if (!seg) {
      // Track-only hit: crosshair follows the mouse, no tooltip.
      return {
        tooltipId: 'scarf-segment-tooltip',
        content: [],
        anchorX: mx,
        anchorY: my,
        data: { row, x: mx },
      }
    }

    return {
      tooltipId: 'scarf-segment-tooltip',
      content: getTooltipContent(seg.participantId as number, seg.orderId),
      anchorX: frame.x + (seg.x + seg.width) * frame.width,
      anchorY: seg.y * rowHeight + rowHeight + plotTop,
      tooltipWidth: SCARF_LAYOUT.TOOLTIP_WIDTH,
      data: { row, x: mx },
    }
  }

  // ── Pointer / drag (via the frame's generic pointer lifecycle) ──
  function handlePointerDown(p: FramePointer) {
    const item = isMouseOverLegendItem(p.x, p.y)
    if (item) onLegendClick(item.identifier)
  }

  function handlePointerDrag(d: FrameDrag) {
    if (!inPlotArea(d.startX, d.startY)) return
    if (Math.abs(d.dx) > 0.5) {
      onDragStepX(d.dx, width)
    }
  }

  function handlePointerUp(p: FramePointer & { dragged: boolean }) {
    if (p.dragged) onDragEnd()
  }

  function findSegmentAtRowAndTime(rowIndex: number, mouseX: number, frame: PlotFrame) {
    const { indexToId } = identifierSystem
    const scale = layout.scaleFactor
    const floorLeft = frame.x
    const floorWidth = frame.width

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
      const { startIndex, endIndex } = gs.reader.getSegmentRange(gs.stimulusId, pid)

      // `thin` mirrors the renderer's explicit flag (see gazeRectVPlacement):
      // a 5-visible-AOI fixation slice's height equals HNF, so the value alone
      // cannot discriminate.
      const build = (styleIdx: number, thin: boolean, hOrig: number, internalYDefault: number, orderId: number, xN: number, wN: number) => {
        let rectH = hOrig
        let internalY = internalYDefault
        if (scale !== 1) {
          if (thin) {
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
        if (end <= clipMin) continue
        // Time-ordered per participant: nothing later can intersect the clip.
        if (start >= clipMax) break
        start = Math.max(clipMin, start)
        end = Math.min(clipMax, end)
        const xN = (start - clipMin) * pScale
        const wN = (end - start) * pScale
        const pxX = floorLeft + xN * floorWidth
        const pxW = wN * floorWidth
        if (mouseX < pxX || mouseX > pxX + pxW) continue

        if (categoryId !== FIXATION_CATEGORY_ID) {
          const sIdx =
            categoryId >= 0 && categoryId < gs.categoryStyleIdxMap.length
              ? gs.categoryStyleIdxMap[categoryId]
              : -1
          if (sIdx === -1) continue
          hit = build(sIdx, true, HNF, SAR + (HBAR - HNF) * 0.5, localId, xN, wN)
        } else {
          // The transformer's precomputed VISIBLE slices (buildResolvedSlices)
          // — the same data the composite and highlight painters read, so
          // hover identity always matches the rendered bands.
          const slot = gs.resolvedSlotBase[rowIndex] + localId
          const s0 = gs.resolvedSliceStart[slot]
          const resolved = gs.resolvedSliceStart[slot + 1] - s0

          if (resolved === 0) {
            if (gs.noAoiStyleIdx < 0) continue
            hit = build(gs.noAoiStyleIdx, false, HBAR, SAR, localId, xN, wN)
          } else {
            const h = HBAR / resolved
            for (let j = 0; j < resolved; j++) {
              hit = build(gs.resolvedSliceStyles[s0 + j], false, h, SAR + j * h, localId, xN, wN) // topmost = last
            }
          }
        }
      }
      return hit
    }

    return null
  }

  onDestroy(() => {
    plot.hideTooltip(0)
  })
</script>

<canvas
  class="scarf-plot-figure"
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  data-component="scarfplot"
  aria-label="Scarf plot visualization"
></canvas>
