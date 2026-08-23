<script lang="ts">
  import {
    alignToPixelCenter,
    markCrosshairStrips,
    strokeCrosshairGuides,
    type HighlightRect,
  } from '$lib/plots/shared/canvasUtils'
  import {
    computeGroupedLegendGeometry,
    drawLegend,
    drawLegendGroupTitles,
    hitTestLegend,
    niceTimelineTicks,
    LEGEND_CONFIG,
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
    cursorGuides,
    drawTimeGuides,
    timeAtX,
    type PlotCursorPort,
  } from '$lib/plots/shared/plotCursor.svelte'
  import { OVERLAY_EVENT_STRIDE, SCARF_LAYOUT } from '../const'
  import { buildScarfEventTooltipContent } from '../core/tooltip'
  import { findGazeSegmentAt } from '../core/hitTest'
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

  const guttersFor = (leftLabelWidth: number, maxHeight?: number): FrameGutters =>
    scarfFrameGutters({
      tickLabels: xAxisTicks.labels ?? [],
      axisTitle: xAxisLabel,
      leftLabelWidth,
      legendSpace,
      maxHeight,
    })

  // ── The row band: the ONE height the scarf's layout reads ──
  // It cannot be `plot.frame.height`, because compact mode decides the left label
  // gutter and would close a loop: pad.left ← isCompact ← row band ← bottom
  // gutter ← the plot width the resolver wraps the axis title to ← pad.left.
  // So the band asks the SAME resolver over the same declaration, with the left
  // inset pinned at its cap: independent of compact mode, and the narrowest plot
  // the scarf can have, so the title wraps to its tallest and the band is never
  // taller than the frame the figure ends up drawing in.
  // LOAD-BEARING: reading frame.height here cycles the derived graph; so would
  // passing the row-stack cap (it derives from the layout this band feeds), so
  // the probe is always uncapped: the full band the rows may grow into.
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
    // the x-axis gutter and the legend block. The row stack caps the frame
    // height: when the rows stop growing (MAX_BAR_SCALE) the resolver cuts the
    // frame to them and centres it, so the border and x-axis hug the rows
    // instead of stretching over empty band.
    // (Return type annotated: the declaration reads values that derive from the
    // handle's own geometry, so inferring it would chase `plot` through itself.)
    gutters: (): FrameGutters =>
      guttersFor(
        LEFT_LABEL_WIDTH,
        // Ceiled so the border never lands inside the last fractional row.
        data.participants.length > 0
          ? Math.ceil(participantBarsHeight)
          : undefined
      ),
    axes: () => ({
      bottom: { title: xAxisLabel, ticks: xAxisTicks },
    }),
    clipData: false,
    drawData: renderScarf,
    drawOverlay: drawScarfOverlay,
    legend: {
      geometry: () => (data.stylingAndLegend ? legendGeometry : null),
      config: LEGEND_CONFIG,
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
              times: () => [timeAtX(rowBand, data.timeline, hover.x)],
              // Slice, not index: an undo that narrows the participants under a
              // resting pointer must read back EMPTY, never throw into a sibling.
              participants: () => participantIds.slice(hover.row, hover.row + 1),
            }
          : null
      ),
    // Return type annotated, same cycle as `gutters`. The rows KEY, not the array:
    // moving within one row must not repaint every sibling.
    overlayDeps: (): string => `${cursorGuide.xsKey}:${cursorGuide.rowsKey}`,
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
  // The frame is already capped to the row stack and centred by the resolver
  // (see `gutters`), so the rows simply start at its top edge.
  const plotTop = $derived(plot.frame.y)
  const legendTop = $derived(plot.frame.legendY + PLOT_LEGEND_GAP)

  const legendGeometry: LegendGeometry = $derived.by(() => {
    if (legendGroups.length === 0) {
      return { items: [], height: 0, groupTitles: [], totalHeight: 0, itemsPerRow: 3 }
    }
    return computeGroupedLegendGeometry(
      legendGroups,
      LEGEND_CONFIG,
      margin,
      legendTop,
      width
    )
  })

  // The rows, not the frame: the frame is the stack's whole-pixel cap (and,
  // under the min-scale floor, can be shorter), so the fractional row stack
  // stays the truth. One source for the blocked region, the time guide and the
  // PLOT CURSOR mark, so a guide can never hang below the last row.
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

  const cursorGuide = cursorGuides({
    cursor: () => plotCursor,
    band: () => rowBand,
    timeline: () => data.timeline,
    rowIds: () => participantIds,
  })

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

    drawLegendGroupTitles(ctx, legendGeometry, LEGEND_CONFIG)
    drawLegend(ctx, legendGeometry, LEGEND_CONFIG, highlights)
  }

  // Overlay layer: the PLOT CURSOR's marks plus the local CROSSHAIR, drawn on top
  // of the cached data layer so mouse-moves repaint via blit instead of re-running
  // renderScarf. Both channels come first — they must survive the local-hover
  // early return.
  function drawScarfOverlay(ctx: CanvasRenderingContext2D) {
    drawTimeGuides(ctx, rowBand, cursorGuide.xs)
    const rects: HighlightRect[] = []
    for (const row of cursorGuide.rows) {
      rects.push({
        x: rowBand.x,
        y: rowY(row),
        width: rowBand.width,
        height: layout.heightOfBarWrap,
        alpha: 0.2,
        along: 'x',
      })
    }
    const hover = plot.hover.data
    if (hover) {
      rects.push({
        x: rowBand.x,
        y: rowY(hover.row),
        width: rowBand.width,
        height: layout.heightOfBarWrap,
        alpha: 0.2,
        along: 'x',
      })
    }
    if (rects.length > 0) {
      markCrosshairStrips(ctx, rects)
    }
    if (hover) {
      const x = alignToPixelCenter(hover.x)
      strokeCrosshairGuides(ctx, [x, rowBand.y, x, rowBand.y + rowBand.height])
    }
  }

  const rowY = (row: number) => rowBand.y + row * layout.heightOfBarWrap

  function isMouseOverLegendItem(mouseX: number, mouseY: number): LegendItemGeometry | null {
    if (!data.stylingAndLegend || !legendGeometry.items.length) return null
    return hitTestLegend(legendGeometry, LEGEND_CONFIG, mouseX, mouseY)
  }

  // The rows, not the frame's band: the fractional row stack is the truth (the
  // frame is its whole-pixel cap), and the pointer handlers aren't gated at all.
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

    // The event band hangs below the AOI seam; a pointer inside it asks about
    // the strip there, not the gaze segment sharing its x.
    const ev = findEventStripAt(row, mx, my, frame)
    if (ev) {
      return {
        content: buildScarfEventTooltipContent(
          data.participants[row]?.label ?? '',
          ev.name,
          ev.start,
          ev.end,
          ev.isPoint
        ),
        anchorX: ev.anchorX,
        anchorY: row * rowHeight + rowHeight + plotTop,
        tooltipWidth: SCARF_LAYOUT.TOOLTIP_WIDTH,
        data: { row, x: mx },
      }
    }

    const seg = findSegmentAtRowAndTime(row, mx, frame)
    if (!seg) {
      // Track-only hit: crosshair follows the mouse, no tooltip.
      return {
        content: [],
        anchorX: mx,
        anchorY: my,
        data: { row, x: mx },
      }
    }

    return {
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

  /**
   * Hit-test the event band of one row against the SAME geometry
   * paintEventStrips draws: lanes hang below the seam, intervals are
   * min-width clamped, points are min-width diamonds — so everything visible
   * is hoverable. Times un-normalize through the row's projection, giving
   * back the clipped-to-view span the strip covers.
   */
  function findEventStripAt(rowIndex: number, mouseX: number, mouseY: number, frame: PlotFrame) {
    const buckets = visualEventBuckets
    const gs = data.gazeSource
    if (!data.isOverlay || !gs || buckets.length === 0 || layout.eventLaneHeight <= 0) return null
    const yIn = mouseY - (plotTop + rowIndex * layout.heightOfBarWrap)
    const bandTop = layout.eventBandTop
    if (yIn < bandTop || yIn >= bandTop + layout.eventZoneHeight) return null
    const lane = Math.floor((yIn - bandTop) / layout.eventLaneHeight)

    const pLeft = frame.x
    const pWidth = frame.width
    const pRight = pLeft + pWidth
    const minInterval = SCARF_LAYOUT.MIN_INTERVAL_PX
    const hw = SCARF_LAYOUT.MIN_POINT_PX / 2
    const clipMin = gs.projClipMin[rowIndex]
    const clipRange = gs.projClipMax[rowIndex] - clipMin || 1
    const { indexToId } = identifierSystem

    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      const count = buffer.length / OVERLAY_EVENT_STRIDE
      for (let i = 0; i < count; i++) {
        const idx = i * OVERLAY_EVENT_STRIDE
        if ((buffer[idx + 1] | 0) !== rowIndex) continue
        if ((buffer[idx + 3] | 0) !== lane) continue
        const xNorm = buffer[idx]
        const wNorm = buffer[idx + 2]
        const isPoint = (buffer[idx + 4] | 0) === 1
        const x = pLeft + xNorm * pWidth
        let anchorX: number
        if (isPoint) {
          const cx = Math.min(pRight - hw, Math.max(pLeft + hw, x))
          if (mouseX < cx - hw || mouseX > cx + hw) continue
          anchorX = cx + hw
        } else {
          let w = wNorm * pWidth
          if (w < minInterval) w = minInterval
          if (x + w > pRight) w = pRight - x
          if (w <= 0 || mouseX < x || mouseX > x + w) continue
          anchorX = x + w
        }
        const identifier = indexToId.get(styleIdx) ?? ''
        const start = clipMin + xNorm * clipRange
        return {
          name:
            data.stylingAndLegend?.event.find(e => e.identifier === identifier)
              ?.name ?? '',
          start,
          end: start + wNorm * clipRange,
          isPoint,
          anchorX,
        }
      }
    }
    return null
  }

  // The tooltip reads only position + identity; style/geometry resolution
  // lives in core/hitTest.ts so the parity test can pin it against the
  // composite's walk.
  function findSegmentAtRowAndTime(rowIndex: number, mouseX: number, frame: PlotFrame) {
    if (!data.gazeSource) return null
    const xNorm = (mouseX - frame.x) / frame.width
    const hit = findGazeSegmentAt(data.gazeSource, rowIndex, xNorm)
    if (!hit) return null
    return {
      x: hit.x,
      y: rowIndex,
      width: hit.width,
      participantId: data.participants[rowIndex]?.id ?? rowIndex,
      orderId: hit.orderId,
    }
  }

</script>

<canvas
  class="scarf-plot-figure"
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  data-component="scarfplot"
  aria-label="Scarf plot visualization"
></canvas>
