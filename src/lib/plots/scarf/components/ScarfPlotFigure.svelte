<script lang="ts">
  import {
    alignToPixelCenter,
    beginCanvasDrawing,
    canvasLifecycleAction,
    finishCanvasDrawing,
    getScaledMousePosition,
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
    useCanvasPlot,
    type LegendGeometry,
    type LegendGroup,
    type LegendItemGeometry,
  } from '$lib/plots/shared'
  import { UI_COLORS } from '$lib/color'
  import { updateTooltip } from '$lib/tooltip'
  import { onDestroy, untrack } from 'svelte'
  import { RECT_STRIDE, SCARF_IDENTIFIERS, SCARF_LAYOUT } from '../const'
  import {
    calculateEffectiveMarginTop,
    calculateEventOnlyLayout,
    calculateIntrinsicContentHeight,
    calculateIsCompactMode,
    calculateLegendStructuralHeight,
    calculateLeftLabelWidth,
    calculatePlotLayout,
    getScarfIdentifierSystem,
    getXAxisLabel,
  } from '../core/layout'
  import {
    calculateEventLayoutOverrides,
    calculateHighlightMask,
    createStyleArrays,
    mapDataToLegendGroups,
  } from '../core/transformer'
  import {
    drawEventChannelRects,
    drawScarfEvents,
    drawScarfGrid,
    drawScarfLabels,
    drawScarfRectangles,
    type ScarfLayoutContext,
  } from '../core/renderer'
  import type { ScarfData, ScarfPlotSettings } from '../types'

  interface Props {
    tooltipAreaElement: HTMLElement | SVGElement | null
    data: ScarfData
    settings: ScarfPlotSettings
    highlights: string[]
    onLegendClick: (identifier: string) => void
    onTooltipActivation: ({
      segmentOrderId,
      participantId,
      x,
      y,
    }: {
      segmentOrderId: number
      participantId: number
      x: number
      y: number
    }) => void
    onTooltipDeactivation: () => void
    onDragStepX?: (stepChange: number) => void
    onDragEnd?: () => void
    chartWidth: number
    availableHeight: number // The actual pixel height from the Grid
    dpiOverride?: number | null // Override for DPI settings when exporting
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }

  // Component props using Svelte 5 $props rune
  let {
    tooltipAreaElement,
    data,
    settings,
    highlights = [],
    onLegendClick = () => {},
    onTooltipActivation = () => {},
    onTooltipDeactivation = () => {},
    onDragStepX = () => {},
    onDragEnd = () => {},
    chartWidth = 0,
    availableHeight,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: Props = $props()

  // Crosshair / hover constants
  const HIGHLIGHT_COLOR = '#007acc'
  const HIGHLIGHT_FILL_ALPHA = 0.2
  const HIGHLIGHT_DASH: number[] = [2, 2]
  const FRAME_TIME = 1000 / 30 // Throttle to 30fps

  // Internal layout constants for compact rendering
  const INTERNAL_PADDING_TOP = 6 // Space for top ticks
  const INTERNAL_PADDING_BOTTOM = 0 // Zero padding at bottom as it serves no purpose (only top needs space for ticks)

  const resolvedDisplayMode = $derived(data.resolvedDisplayMode ?? 'overlay')
  const isEventsOnlyMode = $derived(resolvedDisplayMode === 'events')

  // 1. Calculate Legend structural metrics (data-only, no layout dependency)
  // This breaks the circular dependency: legend structural height depends only on data.
  const legendHeight = $derived(
    calculateLegendStructuralHeight(data.legendData?.groups ?? [], chartWidth)
  )

  // 2. Fixed vertical overhead (margins, padding, legend, axis space)
  const fixedOverheadAbove = $derived(marginTop + INTERNAL_PADDING_TOP)
  const fixedOverheadBelow = $derived(
    45 + legendHeight + marginBottom + INTERNAL_PADDING_BOTTOM
  )
  const totalFixedOverhead = $derived(fixedOverheadAbove + fixedOverheadBelow)

  const netAvailableHeight = $derived(
    Math.max(1, availableHeight - totalFixedOverhead)
  )

  // Events-only layout (independent from segment layout)
  const eventOnlyLayout = $derived.by(() => {
    if (!isEventsOnlyMode) return null
    return calculateEventOnlyLayout(
      data.participants.length,
      data.totalLanesPerParticipant ?? 1,
      netAvailableHeight
    )
  })

  const isCompactMode = $derived(
    calculateIsCompactMode(data.participants.length, netAvailableHeight)
  )

  // Extract participant labels only when needed (normal mode)
  // Stops mapping thousands of names in compact mode
  const participantLabels = $derived.by(() => {
    if (isCompactMode) return []
    return data.participants.map(p => p.label)
  })

  const LEFT_LABEL_WIDTH = $derived(
    calculateLeftLabelWidth(isCompactMode, participantLabels)
  )

  const plotAreaWidth = $derived(
    Math.max(
      0,
      chartWidth -
        marginLeft -
        marginRight -
        LEFT_LABEL_WIDTH -
        SCARF_LAYOUT.RIGHT_MARGIN
    )
  )

  // 2. Dynamic Layout Logic - handles both shrinking AND scaling up
  // Unified scale approach: single scaleFactor applied to bar dimensions
  // Compact mode: when bars get too small, remove labels/gaps for density
  // Iterative scaling: recalculate scale in compact mode to fill freed space
  const layout = $derived(
    calculatePlotLayout(
      data.participants.length,
      netAvailableHeight,
      isCompactMode
    )
  )

  // 3. Derived dimensions using dynamic layout
  const participantBarsHeight = $derived(
    isEventsOnlyMode && eventOnlyLayout
      ? data.participants.length * eventOnlyLayout.rowHeight
      : data.participants.length * layout.heightOfBarWrap
  )
  const axisLabelY = $derived(participantBarsHeight + 30)
  const legendY = $derived(participantBarsHeight + 45)

  // State management with Svelte 5 runes
  let hoveredRowIndex = $state<number | null>(null)
  let mouseXPx = $state<number | null>(null)
  let lastMouseMoveTime = $state(0)
  let isDragging = $state(false)
  let canvas = $state<HTMLCanvasElement | null>(null)
  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => totalWidth,
    getHeight: () => totalHeight,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  let dragStartX = $state(0) // Track drag start position
  let dragStartY = $state(0) // Track drag start position
  let hasDragStarted = $state(false) // Track if drag threshold has been exceeded

  let hoveredLegendItem = $state<LegendItemGeometry | null>(null) // Track currently hovered legend item

  // Use highlights directly from props - workspace is the single source of truth
  const usedHighlights = $derived(highlights)
  const xAxisLabel = $derived(
    getXAxisLabel(
      settings.timeline,
      settings.timelineStart,
      settings.timelineEnd
    )
  )

  // Convert ScarfLegendItem (data-only) to LegendItem (with presentation details)
  // Heights are determined here in the presentation layer using layout constants
  const legendGroups: LegendGroup[] = $derived(
    mapDataToLegendGroups(data.legendData?.groups ?? [])
  )

  // Required height for all content (excluding explicit margins)
  // This is the intrinsic height of the visualization content
  // USES legendHeight (static) instead of legendGeometry.totalHeight (which depends on margins)
  const intrinsicContentHeight = $derived(
    calculateIntrinsicContentHeight(
      legendHeight,
      legendY,
      axisLabelY,
      INTERNAL_PADDING_BOTTOM
    )
  )

  // Vertical centering offset: if available space exceeds content, center vertically
  // Subtracting INTERNAL_PADDING_TOP ensures the centering feels balanced with the top safe area
  const effectiveMarginTop = $derived(
    calculateEffectiveMarginTop(
      availableHeight,
      intrinsicContentHeight,
      marginTop,
      marginBottom,
      INTERNAL_PADDING_TOP
    )
  )

  // Compute final legend geometry using the actual effectiveMarginTop
  // This depends on effectiveMarginTop, but nothing depends back on this geometry's totalHeight
  const legendGeometry: LegendGeometry = $derived.by(() => {
    if (legendGroups.length === 0) {
      return {
        items: [],
        height: 0,
        groupTitles: [],
        totalHeight: 0,
        itemsPerRow: 3,
      }
    }

    const legendX = marginLeft
    const lY = legendY + effectiveMarginTop

    return computeGroupedLegendGeometry(
      legendGroups,
      SCARF_LEGEND_CONFIG,
      legendX,
      lY,
      chartWidth
    )
  })

  // Canvas size exactly matches available chartWidth
  const totalWidth = $derived(chartWidth)

  // Track the currently hovered segment
  let currentHoveredSegment = $state<{
    participantId: string | number
    orderId: number
  } | null>(null)

  // Create a unified identifier mapping system for all style types
  const identifierSystem = $derived.by(() => {
    if (!data.stylingAndLegend)
      return {
        idToIndex: new Map(),
        indexToId: new Map(),
        idToType: new Map(),
        totalIdentifiers: 0,
      }

    return getScarfIdentifierSystem(
      data.stylingAndLegend.aoi.map(i => i.identifier),
      data.stylingAndLegend.category.map(i => i.identifier),
      data.stylingAndLegend.visibility.map(i => i.identifier)
    )
  })

  // Style lookup maps for efficient style access - O(1) instead of O(n)
  const rectStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()
    const aoi = data.stylingAndLegend.aoi
    const category = data.stylingAndLegend.category
    const aoiLen = aoi.length
    const catLen = category.length

    // Pre-compute all rectangle styles (AOI and category) with dimmed state
    for (let i = 0; i < aoiLen; i++) {
      const style = aoi[i]
      const baseStyle = { fill: style.color }
      map.set(style.identifier, {
        normal: baseStyle,
        dimmed: {
          ...baseStyle,
          opacity: 0.15,
        },
      })
    }

    for (let i = 0; i < catLen; i++) {
      const style = category[i]
      const baseStyle = { fill: style.color }
      map.set(style.identifier, {
        normal: baseStyle,
        dimmed: {
          ...baseStyle,
          opacity: 0.15,
        },
      })
    }

    return map
  })

  const eventStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()
    const visibility = data.stylingAndLegend.visibility
    const len = visibility.length

    // Visibility events use fixed stroke width
    const strokeWidth = 1

    // Pre-compute all event styles (visibility) with dimmed state
    for (let i = 0; i < len; i++) {
      const style = visibility[i]
      const baseStyle = {
        stroke: style.color,
        strokeWidth,
      }
      map.set(style.identifier, {
        normal: baseStyle,
        dimmed: {
          ...baseStyle,
          opacity: 0.15,
        },
      })
    }

    return map
  })

  // Highlight mask by style index (computed once per highlight change)
  const highlightMaskByIndex = $derived(
    calculateHighlightMask(usedHighlights, identifierSystem)
  )

  // Map event channel array index → identifier system style index (for highlight lookup)
  const channelStyleIndices = $derived.by(() => {
    if (!data.eventChannels) return null
    return data.eventChannels.map(ch =>
      identifierSystem.idToIndex.get(`${SCARF_IDENTIFIERS.EVENT}${ch.id}`) ?? -1
    )
  })

  // Total content height with effective margins
  const totalContentHeight = $derived(
    intrinsicContentHeight + effectiveMarginTop + marginBottom
  )

  // Canvas height is strictly the available height (no scrolling)
  const totalHeight = $derived(availableHeight)

  // Check if we have enough space to render
  // In compact mode, we can render with much less space (min 1px per participant)
  // but we enforce a minimum plot area height to avoid cropping the rotated axis label
  const canRender = $derived.by(() => {
    // Minimum plot height to avoid complete collapse
    const minPlotHeight = isCompactMode
      ? Math.max(
          data.participants.length * SCARF_LAYOUT.MIN_BAR_HEIGHT,
          SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT
        )
      : SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT // Fallback min height

    return netAvailableHeight >= minPlotHeight
  })

  // These MUST be declared before any derived values that use them
  const visualRectBuckets = $derived(data.visualRectBuckets)
  const visualEventBuckets = $derived(data.visualEventBuckets)

  // Optimize lookups: Convert Maps to dense Arrays once per dependency change
  const styleArrays = $derived(
    createStyleArrays(
      identifierSystem,
      rectStyleMap,
      eventStyleMap,
      visualRectBuckets.length,
      visualEventBuckets.length
    )
  )
  const rectStyleArray = $derived(styleArrays.rectStyles)
  const eventStyleArray = $derived(styleArrays.eventStyles)

  // Calculate layout overrides for overlapping events
  // IMPORTANT: This computation is expensive. We minimize reactive dependencies
  // by using source data values directly and computing in normalized space.
  const eventLayoutOverrides = $derived(
    calculateEventLayoutOverrides(
      isCompactMode,
      visualEventBuckets,
      data.barHeight,
      data.heightOfBarWrap
    )
  )

  // Interaction handlers
  function handleLegendIdentifier(identifier: string) {
    // Propagate to parent component - workspace is single source of truth
    onLegendClick(identifier)
  }

  // Canvas drawing functions
  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)

    const ctx = plot.canvasState.context
    if (!ctx) return

    if (!canRender) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.font = '14px sans-serif'
      ctx.fillText(
        'Increase height to view plot',
        totalWidth / 2,
        totalHeight / 2
      )
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const scarfPlotLeft = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
    const scarfPlotWidth = Math.floor(plotAreaWidth)

    const renderCtx: ScarfLayoutContext = {
      heightOfBar: isEventsOnlyMode && eventOnlyLayout
        ? eventOnlyLayout.rowHeight
        : layout.heightOfBar,
      spaceAboveRect: isEventsOnlyMode ? 0 : layout.spaceAboveRect,
      nonFixationHeight: isEventsOnlyMode ? 0 : layout.nonFixationHeight,
      heightOfBarWrap: isEventsOnlyMode && eventOnlyLayout
        ? eventOnlyLayout.rowHeight
        : layout.heightOfBarWrap,
      scaleFactor: isEventsOnlyMode ? 1 : layout.scaleFactor,
      isCompact: isEventsOnlyMode ? false : layout.isCompact,
      leftLabelWidth: LEFT_LABEL_WIDTH,
      plotAreaWidth: plotAreaWidth,
      effectiveMarginTop: effectiveMarginTop,
      participantBarsHeight: participantBarsHeight,
      totalWidth: totalWidth,
      marginLeft: marginLeft,
    }

    // 1. Draw Axis/Grid structure
    drawScarfLabels(ctx, data, renderCtx)
    drawScarfGrid(ctx, data, renderCtx)

    // 2. Draw Data segments (mode-aware)
    if (isEventsOnlyMode && eventOnlyLayout) {
      drawEventChannelRects(
        ctx,
        data,
        renderCtx,
        eventOnlyLayout.laneHeight,
        eventOnlyLayout.rowHeight,
        highlightMaskByIndex,
        channelStyleIndices
      )
    } else {
      drawScarfRectangles(
        ctx,
        data,
        renderCtx,
        rectStyleArray,
        highlightMaskByIndex
      )
      if (resolvedDisplayMode !== 'segments') {
        drawScarfEvents(
          ctx,
          data,
          renderCtx,
          eventStyleArray,
          highlightMaskByIndex,
          eventLayoutOverrides
        )
      }
    }

    // 2.5. Draw crosshair highlight (above data, below text/legend)
    drawCrosshairHighlight(
      ctx,
      scarfPlotLeft,
      effectiveMarginTop,
      scarfPlotWidth,
      participantBarsHeight,
      isEventsOnlyMode && eventOnlyLayout
        ? eventOnlyLayout.rowHeight
        : layout.heightOfBarWrap
    )

    // 3. Draw plot-area chrome (ticks on top+bottom, labels on bottom, full border)
    const scarfXTicks = niceTimelineTicks(data.timeline)
    drawPlotArea(ctx, {
      x: scarfPlotLeft,
      y: effectiveMarginTop,
      width: scarfPlotWidth,
      height: participantBarsHeight,
      ticks: { bottom: scarfXTicks, top: { positions: scarfXTicks.positions } },
    })
    drawXAxisLabel(
      ctx,
      xAxisLabel,
      scarfPlotLeft,
      scarfPlotWidth,
      participantBarsHeight + effectiveMarginTop,
      30
    )

    // 4. Draw legend
    drawLegendGroupTitles(ctx, legendGeometry, SCARF_LEGEND_CONFIG)
    drawLegend(ctx, legendGeometry, SCARF_LEGEND_CONFIG, usedHighlights)

    finishCanvasDrawing(plot.canvasState)
  }

  function drawCrosshairHighlight(
    ctx: CanvasRenderingContext2D,
    plotLeft: number,
    plotTop: number,
    plotWidth: number,
    plotHeight: number,
    rowHeight: number
  ) {
    if (hoveredRowIndex === null || mouseXPx === null) return

    const rowY = plotTop + hoveredRowIndex * rowHeight

    // 1. Light blue fill over hovered participant row
    ctx.save()
    ctx.globalAlpha = HIGHLIGHT_FILL_ALPHA
    ctx.fillStyle = HIGHLIGHT_COLOR
    ctx.fillRect(plotLeft, rowY, plotWidth, rowHeight)
    ctx.restore()

    // 2. Blue dashed borders on top/bottom edges of row
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

    // 3. Vertical dashed crosshair at mouse X
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

  // Check if a mouse click or hover is on a legend item
  function isMouseOverLegendItem(
    mouseX: number,
    mouseY: number
  ): LegendItemGeometry | null {
    if (!data.stylingAndLegend || !legendGeometry.items.length) return null
    return hitTestLegend(legendGeometry, SCARF_LEGEND_CONFIG, mouseX, mouseY)
  }

  // Mouse event handling for canvas
  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) return
    lastMouseMoveTime = currentTime

    if (!canvas) return

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(plot.canvasState, event)

    // Check if mouse is over a legend item
    const legendItem = isMouseOverLegendItem(mouseX, mouseY)

    // Handle legend item tooltips
    // Use identifier comparison to avoid "state_proxy_equality_mismatch"
    // Svelte 5 proxies and raw objects are not equal, so we compare unique IDs
    const currentId = legendItem?.identifier
    const hoveredId = hoveredLegendItem?.identifier

    if (currentId !== hoveredId) {
      if (legendItem) {
        // Show tooltip with "Highlight [FULLNAMEOFAOI]" or "Dehighlight [FULLNAMEOFAOI]" text
        hoveredLegendItem = legendItem
        const isHighlighted = usedHighlights.includes(legendItem.identifier)

        // Use utility functions for tooltip
        const tooltipContent = getLegendTooltipContent(
          legendItem,
          isHighlighted
        )
        const tooltipItemPos = getLegendTooltipPosition(
          legendItem,
          SCARF_LEGEND_CONFIG
        )
        const tooltipPos = getTooltipPosition(
          plot.canvasState,
          tooltipItemPos.x,
          tooltipItemPos.y,
          { x: 0, y: 7 }
        )

        updateTooltip({
          id: legendItem.identifier,
          visible: true,
          content: tooltipContent,
          x: tooltipPos.x,
          y: tooltipPos.y,
        })
      } else if (hoveredLegendItem) {
        // Hide tooltip when mouse leaves legend item
        hoveredLegendItem = null
        updateTooltip(null)
      }
    }

    if (hoveredLegendItem) {
      canvas.style.cursor = 'pointer'
      // Clear crosshair when over legend
      if (hoveredRowIndex !== null) {
        hoveredRowIndex = null
        mouseXPx = null
        plot.scheduleRender()
      }
      return
    }

    // Check if mouse is in the plot area
    const inPlotArea =
      mouseX >= LEFT_LABEL_WIDTH + marginLeft &&
      mouseX <= LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft &&
      mouseY >= effectiveMarginTop &&
      mouseY <= participantBarsHeight + effectiveMarginTop

    if (!inPlotArea) {
      canvas.style.cursor = 'default'
      if (hoveredRowIndex !== null) {
        hoveredRowIndex = null
        mouseXPx = null
        plot.scheduleRender()
      }
      if (currentHoveredSegment) {
        currentHoveredSegment = null
        onTooltipDeactivation()
      }
      return
    }

    canvas.style.cursor = 'crosshair'

    // Update crosshair state
    const rowHeight = isEventsOnlyMode && eventOnlyLayout
      ? eventOnlyLayout.rowHeight
      : layout.heightOfBarWrap
    const relativeY = mouseY - effectiveMarginTop
    const newRowIndex = Math.floor(relativeY / rowHeight)
    hoveredRowIndex = (newRowIndex >= 0 && newRowIndex < data.participants.length)
      ? newRowIndex
      : null
    mouseXPx = mouseX
    plot.scheduleRender()

    // Find the segment under the mouse pointer using TypedArray
    const hoveredSegment = hoveredRowIndex !== null
      ? findSegmentAtRowAndTime(hoveredRowIndex, mouseX)
      : null

    // If hovering over a new segment, show tooltip
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

      const pIndex = hoveredSegment.y
      const floorLeft = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
      const floorWidth = Math.floor(plotAreaWidth)
      const segEndX = floorLeft + (hoveredSegment.x + hoveredSegment.width) * floorWidth
      const rowBottomY = pIndex * rowHeight + rowHeight + effectiveMarginTop

      const tooltipPos = getTooltipPosition(
        plot.canvasState,
        segEndX,
        rowBottomY,
        { x: 5, y: 5 }
      )

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

  function handleMouseLeave() {
    // Clear crosshair highlight
    if (hoveredRowIndex !== null || mouseXPx !== null) {
      hoveredRowIndex = null
      mouseXPx = null
      plot.scheduleRender()
    }

    if (hoveredLegendItem) {
      hoveredLegendItem = null
      updateTooltip(null)
    }

    if (currentHoveredSegment) {
      currentHoveredSegment = null
      onTooltipDeactivation()
    }

    // Reset drag state
    if (isDragging) {
      isDragging = false
    }
    hasDragStarted = false

    dragStartX = 0
    dragStartY = 0
  }

  // Drag handlers
  function handleMouseDown(event: MouseEvent) {
    if (!canvas) return

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(plot.canvasState, event)

    // Check if clicking on a legend item
    const clickedLegendItem = isMouseOverLegendItem(mouseX, mouseY)
    if (clickedLegendItem) {
      // Handle legend item click
      handleLegendIdentifier(clickedLegendItem.identifier)
      return
    }

    // Only prepare for potential drag in the chart area
    if (
      mouseX >= LEFT_LABEL_WIDTH + marginLeft &&
      mouseX <= LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft &&
      mouseY >= effectiveMarginTop &&
      mouseY <= participantBarsHeight + effectiveMarginTop
    ) {
      // Store initial position and prepare for dragging
      dragStartX = mouseX
      dragStartY = mouseY
      hasDragStarted = false

    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false
      onDragEnd()
    }
    // Reset all drag state
    hasDragStarted = false

    dragStartX = 0
    dragStartY = 0
  }

  function handleDrag(event: MouseEvent) {
    if (!canvas) return

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(plot.canvasState, event)

    // If we haven't started dragging yet, check if we should
    if (!hasDragStarted && dragStartX !== 0) {
      const deltaX = Math.abs(mouseX - dragStartX)
      const deltaY = Math.abs(mouseY - dragStartY)
      const threshold = 5 // 5px threshold to distinguish click from drag

      if (deltaX > threshold || deltaY > threshold) {
        // Start actual dragging
        hasDragStarted = true
        isDragging = true
      } else {
        // Still within threshold, don't start dragging yet
        return
      }
    }

    // Only proceed if we're actually dragging
    if (!isDragging) return

    // Check if mouse is over legend - stop dragging if it is
    const hoveredLegendItem = isMouseOverLegendItem(mouseX, mouseY)
    if (hoveredLegendItem) {
      isDragging = false
      hasDragStarted = false
  
      dragStartX = 0
      dragStartY = 0
      return
    }

    const dragDeltaX = mouseX - dragStartX

    if (Math.abs(dragDeltaX) > 1) {
      // Call the drag step handler with the delta
      onDragStepX(dragDeltaX)

      // Reset the drag start position for continuous dragging
      dragStartX = mouseX
    }
  }

  // Re-render when any visual dependency changes.
  // Svelte 5 tracks all reactive reads implicitly — listing them
  // in an array is unnecessary but we reference them so the effect fires.
  $effect(() => {
    data
    settings
    totalWidth
    totalHeight
    highlights
    usedHighlights
    chartWidth
    availableHeight
    dpiOverride
    marginLeft
    marginRight
    effectiveMarginTop
    marginBottom

    untrack(() => plot.refresh())
  })

  function findSegmentAtRowAndTime(rowIndex: number, mouseX: number) {
    const buckets = visualRectBuckets
    if (buckets.length === 0) return null

    const { indexToId } = identifierSystem
    const scale = layout.scaleFactor
    const floorLeft = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
    const floorWidth = Math.floor(plotAreaWidth)

    for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      for (let i = buffer.length / RECT_STRIDE - 1; i >= 0; i--) {
        const idx = i * RECT_STRIDE
        const pIndex = buffer[idx + 1]
        if (pIndex !== rowIndex) continue

        const xNormalized = buffer[idx]
        const widthNormalized = buffer[idx + 2]
        const origRectH = buffer[idx + 3]
        const origInternalY = buffer[idx + 7]

        const pxX = floorLeft + xNormalized * floorWidth
        const pxW = widthNormalized * floorWidth

        if (mouseX >= pxX && mouseX <= pxX + pxW) {
          let rectH = origRectH
          let internalY = origInternalY

          if (scale !== 1) {
            if (origRectH === SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT) {
              rectH = layout.nonFixationHeight
              internalY =
                layout.spaceAboveRect +
                (layout.heightOfBar - layout.nonFixationHeight) / 2
            } else {
              rectH = origRectH * scale
              internalY =
                layout.spaceAboveRect +
                (origInternalY - SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT) * scale
            }
          }

          return {
            x: xNormalized,
            y: pIndex,
            width: widthNormalized,
            height: rectH,
            internalY,
            identifier: indexToId.get(styleIdx) ?? '',
            participantId: buffer[idx + 4],
            segmentId: buffer[idx + 5],
            orderId: buffer[idx + 6],
          }
        }
      }
    }
    return null
  }

  // Clean up tooltip when unmounting
  onDestroy(() => {
    if (hoveredLegendItem) {
      updateTooltip(null)
    }
  })
</script>

<svelte:window onmousemove={handleDrag} onmouseup={handleMouseUp} />

<canvas
  class="scarf-plot-figure"
  style:pointer-events={canRender ? 'auto' : 'none'}
  width={totalWidth}
  height={totalHeight}
  use:canvasLifecycleAction={plot.actionOptions}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onmousedown={handleMouseDown}
  bind:this={canvas}
  data-component="scarfplot"
  aria-label="Scarf plot visualization"
></canvas>
