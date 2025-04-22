<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { addInfoToast } from '$lib/stores/toastStore'
  import { calculateLabelOffset } from '$lib/components/Plot/utils/textUtils'
  import { draggable } from '$lib/actions/draggable'
  import { onMount } from 'svelte'

  // CONSTANTS - layout dimensions and styling
  const LAYOUT = {
    LEFT_LABEL_MAX_WIDTH: 125, // Width for participant labels
    AXIS_LABEL_HEIGHT: 30, // Height for the x-axis label
    LEGEND_HEIGHT: 100, // Height for the legend
    LABEL_FONT_SIZE: 12, // Font size for labels
    PADDING: 0, // General padding
    RIGHT_MARGIN: 15, // Right margin to prevent tick label cropping
    MIN_CHART_HEIGHT: 50, // Minimum chart height
    TICK_LENGTH: 5, // Length of axis ticks
    AXIS_OFFSET: 12, // Offset for axis labels
    GRID_COLOR: '#cbcbcb', // Color for grid lines
    GRID_STROKE_WIDTH: 1, // Stroke width for grid lines
    LEGEND_ITEM_WIDTH: 100, // Width of each legend item
    LEGEND_ITEM_HEIGHT: 15, // Height of each legend item
    LEGEND_ITEMS_PER_ROW: 3, // Number of legend items per row
  }

  interface Props {
    tooltipAreaElement: HTMLElement | SVGElement | null
    data: ScarfFillingType
    settings: ScarfGridType
    highlightedIdentifier: string | null
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
    chartWidth: number
  }

  // Component props using Svelte 5 $props rune
  let {
    tooltipAreaElement,
    data,
    settings,
    highlightedIdentifier = null,
    onLegendClick = () => {},
    onTooltipActivation = () => {},
    onTooltipDeactivation = () => {},
    onDragStepX = () => {},
    chartWidth = 0,
  }: Props = $props()

  // Calculate legend height based on content
  function calculateLegendHeight(): number {
    if (!data.stylingAndLegend) return LAYOUT.LEGEND_HEIGHT

    const LEGEND_CONFIG = {
      TITLE_HEIGHT: 18,
      ITEM_HEIGHT: LAYOUT.LEGEND_ITEM_HEIGHT,
      ITEM_PADDING: 4,
      ITEM_PER_ROW: LAYOUT.LEGEND_ITEMS_PER_ROW,
      GROUP_SPACING: 10,
    }

    // Calculate row counts for each section
    const aoiRows = Math.ceil(
      data.stylingAndLegend.aoi.length / LEGEND_CONFIG.ITEM_PER_ROW
    )
    const categoryRows = Math.ceil(
      data.stylingAndLegend.category.length / LEGEND_CONFIG.ITEM_PER_ROW
    )
    const visibilityRows =
      data.stylingAndLegend.visibility.length > 0
        ? Math.ceil(
            data.stylingAndLegend.visibility.length / LEGEND_CONFIG.ITEM_PER_ROW
          )
        : 0

    // Calculate total height with spacing
    const groupCount = visibilityRows > 0 ? 3 : 2
    const totalRows = aoiRows + categoryRows + visibilityRows

    return (
      LEGEND_CONFIG.TITLE_HEIGHT * groupCount +
      totalRows * (LEGEND_CONFIG.ITEM_HEIGHT + LEGEND_CONFIG.ITEM_PADDING) +
      (groupCount - 1) * LEGEND_CONFIG.GROUP_SPACING +
      LAYOUT.PADDING
    )
  }

  const LEFT_LABEL_WIDTH = $derived(
    // use calculateLabelOffset to calculate the width of the participant labels
    calculateLabelOffset(
      data.participants.map(p => p.label),
      LAYOUT.LABEL_FONT_SIZE
    ) + 10
  )

  // State management with Svelte 5 runes
  let fixedHighlight = $state<string | null>(null)
  let isDragging = $state(false) // New state to track if actively dragging
  let isHoveringSegment = $state(false) // Track if hovering or recently hovering a segment
  let hoverTimeout: number | null = $state(null) // Timeout ID
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasCtx = $state<CanvasRenderingContext2D | null>(null)
  let lastMouseX = $state(0)
  let lastMouseY = $state(0)
  let dragStartX = $state(0)
  let pixelRatio = $state(1)

  // Derived values using Svelte 5 $derived rune
  const usedHighlight = $derived(fixedHighlight ?? highlightedIdentifier)
  const xAxisLabel = $derived(getXAxisLabel(settings))
  const scarfPlotAreaId = $derived(`scarf-plot-area-${settings.id}`)

  // SVG size calculations - MOVE THESE BEFORE RECTANGLE/LINE CALCULATIONS
  const totalWidth = $derived(chartWidth)

  // Track the currently hovered segment
  let currentHoveredSegment = $state<{
    participantId: string | number
    orderId: number
  } | null>(null)

  // Calculate actual plot area width (without label area and with right margin)
  const plotAreaWidth = $derived(
    Math.max(
      0,
      chartWidth - LEFT_LABEL_WIDTH - LAYOUT.PADDING * 2 - LAYOUT.RIGHT_MARGIN
    )
  )

  const chartHeight = $derived(
    Math.max(data.chartHeight, LAYOUT.MIN_CHART_HEIGHT)
  )

  const legendHeight = $derived(calculateLegendHeight())

  const totalHeight = $derived(
    chartHeight + LAYOUT.AXIS_LABEL_HEIGHT + legendHeight
  )

  // Style lookup maps for efficient style access - O(1) instead of O(n)
  const rectStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()

    // Pre-compute all rectangle styles (AOI and category)
    ;[...data.stylingAndLegend.aoi, ...data.stylingAndLegend.category].forEach(
      style => {
        map.set(style.identifier, { fill: style.color })
      }
    )

    return map
  })

  const lineStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()

    // Pre-compute all line styles (visibility)
    data.stylingAndLegend.visibility.forEach(style => {
      map.set(style.identifier, {
        stroke: style.color,
        strokeWidth: style.height,
        strokeDasharray: '1',
      })
    })

    return map
  })

  // Helper functions for calculating styles - now with O(1) lookups
  function getStyleForRect(
    identifier: string,
    isHighlighted: boolean
  ): { fill: string; opacity?: number; stroke?: string; strokeWidth?: number } {
    // Get pre-computed style or fallback
    const baseStyle = rectStyleMap.get(identifier) || { fill: '#ccc' }

    // Apply highlighting effects
    if (usedHighlight) {
      if (identifier === usedHighlight) {
        // This is the highlighted element
        return {
          ...baseStyle,
          stroke: '#333333',
          strokeWidth: 0.5,
        }
      } else {
        // This is not the highlighted element
        return {
          ...baseStyle,
          opacity: 0.15,
        }
      }
    }

    return baseStyle
  }

  function getStyleForLine(
    identifier: string,
    isHighlighted: boolean
  ): {
    stroke: string
    strokeWidth: number
    opacity?: number
    strokeDasharray?: string
    strokeLinecap?: 'butt' | 'inherit' | 'round' | 'square' | null
  } {
    // Get pre-computed style or fallback
    const baseStyle = lineStyleMap.get(identifier) || {
      stroke: '#ccc',
      strokeWidth: 1,
    }

    // Apply highlighting effects
    if (usedHighlight) {
      if (identifier === usedHighlight) {
        // This is the highlighted element
        return {
          stroke: baseStyle.stroke,
          strokeWidth: 3,
          strokeLinecap: 'butt',
          strokeDasharray: 'none',
        }
      } else {
        // This is not the highlighted element
        return {
          ...baseStyle,
          opacity: 0.15,
        }
      }
    }

    return baseStyle
  }

  // Separate derived stores for rectangle and line segments
  const rectangleSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return []

    return data.participants.flatMap((participant, participantIndex) => {
      const isOrdinal = settings.timeline === 'ordinal'
      const isAbsolute = settings.timeline === 'absolute'
      const pWidth = isAbsolute ? participant.width : undefined
      const y0 = participantIndex * data.heightOfBarWrap

      return participant.segments.flatMap((segment, segmentId) =>
        segment.content.map(rectangle => {
          const identifier = rectangle.identifier
          const isHighlighted = identifier === usedHighlight
          const style = getStyleForRect(identifier, isHighlighted)

          return {
            identifier: identifier, // Keep identifier for event handling
            height: rectangle.height,
            x:
              LEFT_LABEL_WIDTH +
              (isOrdinal ? getSegmentX(rectangle.x) : getSegmentX(rectangle.x)),
            y: y0 + rectangle.y,
            width: isOrdinal
              ? getSegmentWidth(rectangle.width)
              : getSegmentWidth(rectangle.width),
            participantId: participant.id,
            segmentId,
            orderId: rectangle.orderId,
            // Include style properties
            fill: style.fill,
            opacity: style.opacity ?? 1,
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
          }
        })
      )
    })
  })

  const lineSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return []

    return data.participants.flatMap((participant, participantIndex) => {
      const isOrdinal = settings.timeline === 'ordinal'
      const isAbsolute = settings.timeline === 'absolute'
      const pWidth = isAbsolute ? participant.width : undefined
      const y0 = participantIndex * data.heightOfBarWrap

      // Don't process lines in ordinal mode
      if (isOrdinal) return []

      return participant.dynamicAoiVisibility.flatMap(visibility => {
        return visibility.content.map(item => {
          const identifier = item.identifier
          const isHighlighted = identifier === usedHighlight
          const style = getStyleForLine(identifier, isHighlighted)

          return {
            identifier: identifier, // Keep identifier for event handling
            x1: LEFT_LABEL_WIDTH + getVisibilityLineX(item.x1, pWidth),
            y1: y0 + item.y,
            x2: LEFT_LABEL_WIDTH + getVisibilityLineX(item.x2, pWidth),
            y2: y0 + item.y,
            participantId: participant.id,
            // Include style properties
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            opacity: style.opacity ?? 1,
            strokeDasharray: style.strokeDasharray,
            strokeLinecap: style.strokeLinecap,
          }
        })
      })
    })
  })

  // Helper functions
  function getTimelineUnit(settings: ScarfGridType): string {
    return settings.timeline === 'relative' ? '%' : 'ms'
  }

  function getXAxisLabel(settings: ScarfGridType): string {
    return settings.timeline === 'ordinal'
      ? 'Order index'
      : `Elapsed time [${getTimelineUnit(settings)}]`
  }

  function getSegmentX(x: number): number {
    if (!plotAreaWidth) return 0

    // All calculations now use the numeric value directly
    return x * plotAreaWidth
  }

  function getSegmentWidth(width: number): number {
    if (!plotAreaWidth) return 0

    // All calculations now use the numeric value directly
    return width * plotAreaWidth
  }

  function getVisibilityLineX(x: number, participantWidth?: number): number {
    if (!plotAreaWidth) return 0

    if (settings.timeline === 'ordinal') {
      return 0 // Not applicable in ordinal mode
    } else {
      // Cap at 1.0 (100%)
      const xValue = Math.min(x, 1.0)
      return xValue * plotAreaWidth
    }
  }

  // Interaction handlers
  function handleFixedHighlight(identifier: string) {
    if (fixedHighlight === identifier) {
      // If already highlighted, clear it
      fixedHighlight = null
      highlightedIdentifier = null
      renderCanvas() // Redraw canvas
      return
    }

    // Otherwise, set the fixed highlight
    fixedHighlight = identifier
    addInfoToast(`Highlight fixed. Click the same item in the legend to remove`)
    renderCanvas() // Redraw canvas
  }

  function handleLegendIdentifier(identifier: string) {
    // Handle both local fixed highlight and external app state
    handleFixedHighlight(identifier)
    onLegendClick(identifier)
  }

  // Canvas drawing functions
  function clearCanvas() {
    if (!canvasCtx || !canvas) return
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function setupCanvas() {
    if (!canvas) return

    // Get and save the context
    canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    // Set up for high-DPI displays
    pixelRatio = window.devicePixelRatio || 1

    resizeCanvas()

    // Initial render
    renderCanvas()

    // Bind the tooltip area element
    tooltipAreaElement = canvas
  }

  function resizeCanvas() {
    if (!canvas || !canvasCtx) return

    // Set actual canvas dimensions (scaled for high DPI)
    canvas.width = totalWidth * pixelRatio
    canvas.height = totalHeight * pixelRatio

    // Set display size (css pixels)
    canvas.style.width = `${totalWidth}px`
    canvas.style.height = `${totalHeight}px`
  }

  function renderCanvas() {
    if (!canvasCtx || !canvas) return
    clearCanvas()

    // Scale all drawing operations by the device pixel ratio
    canvasCtx.save()
    canvasCtx.scale(pixelRatio, pixelRatio)

    // Draw participant labels (Left Side)
    drawParticipantLabels()

    // Draw horizontal grid lines
    drawHorizontalGridLines()

    // Draw timeline axis labels and ticks
    drawTimelineLabels()

    // Draw X-Axis ticks and bottom border
    drawXAxisTicksAndBorder()

    // Draw rectangle segments
    drawRectangles()

    // Draw line segments
    drawLines()

    // Draw X-Axis label
    drawXAxisLabel()

    // Draw the legend
    drawLegend()

    canvasCtx.restore()
  }

  function drawParticipantLabels() {
    if (!canvasCtx) return

    canvasCtx.font = `${LAYOUT.LABEL_FONT_SIZE}px sans-serif`
    canvasCtx.fillStyle = '#000'
    canvasCtx.textAlign = 'start'
    canvasCtx.textBaseline = 'middle'

    data.participants.forEach((participant, i) => {
      canvasCtx!.fillText(
        participant.label,
        LAYOUT.PADDING,
        i * data.heightOfBarWrap + data.heightOfBarWrap / 2
      )
    })
  }

  function drawHorizontalGridLines() {
    if (!canvasCtx) return

    canvasCtx.strokeStyle = LAYOUT.GRID_COLOR
    canvasCtx.lineWidth = LAYOUT.GRID_STROKE_WIDTH

    data.participants.forEach((_, i) => {
      const y = i * data.heightOfBarWrap + 0.5
      canvasCtx!.beginPath()
      canvasCtx!.moveTo(LEFT_LABEL_WIDTH, y)
      canvasCtx!.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth, y)
      canvasCtx!.stroke()
    })
  }

  function drawTimelineLabels() {
    if (!canvasCtx || data.timeline.ticks.length === 0) return

    canvasCtx.font = `${LAYOUT.LABEL_FONT_SIZE}px sans-serif`
    canvasCtx.fillStyle = '#000'
    canvasCtx.textAlign = 'center'
    canvasCtx.textBaseline = 'hanging'

    data.timeline.ticks.forEach(tick => {
      if (tick.isNice) {
        canvasCtx!.fillText(
          tick.label,
          LEFT_LABEL_WIDTH + tick.position * plotAreaWidth,
          data.chartHeight - LAYOUT.AXIS_OFFSET
        )
      }
    })
  }

  function drawXAxisTicksAndBorder() {
    if (!canvasCtx) return

    canvasCtx.strokeStyle = LAYOUT.GRID_COLOR
    canvasCtx.lineWidth = 1.5

    // Draw ticks
    data.timeline.ticks.forEach(tick => {
      const x = LEFT_LABEL_WIDTH + tick.position * plotAreaWidth
      const y1 = data.participants.length * data.heightOfBarWrap - 0.5
      const y2 = y1 + LAYOUT.TICK_LENGTH

      canvasCtx!.beginPath()
      canvasCtx!.moveTo(x, y1)
      canvasCtx!.lineTo(x, y2)
      canvasCtx!.stroke()
    })

    // Draw bottom border line
    canvasCtx.beginPath()
    canvasCtx.moveTo(
      LEFT_LABEL_WIDTH,
      data.participants.length * data.heightOfBarWrap - 0.5
    )
    canvasCtx.lineTo(
      LEFT_LABEL_WIDTH + plotAreaWidth,
      data.participants.length * data.heightOfBarWrap - 0.5
    )
    canvasCtx.stroke()
  }

  function drawRectangles() {
    if (!canvasCtx) return

    rectangleSegments.forEach(rect => {
      canvasCtx!.globalAlpha = rect.opacity
      canvasCtx!.fillStyle = rect.fill

      canvasCtx!.fillRect(rect.x, rect.y, rect.width, rect.height)

      if (rect.stroke) {
        canvasCtx!.strokeStyle = rect.stroke
        canvasCtx!.lineWidth = rect.strokeWidth || 1
        canvasCtx!.strokeRect(rect.x, rect.y, rect.width, rect.height)
      }
    })

    canvasCtx.globalAlpha = 1
  }

  function drawLines() {
    if (!canvasCtx) return

    lineSegments.forEach(line => {
      canvasCtx!.globalAlpha = line.opacity
      canvasCtx!.strokeStyle = line.stroke
      canvasCtx!.lineWidth = line.strokeWidth

      // Handle line dash
      if (line.strokeDasharray && line.strokeDasharray !== 'none') {
        canvasCtx!.setLineDash([2, 2]) // Simple dash pattern
      } else {
        canvasCtx!.setLineDash([])
      }

      // Handle line cap
      if (line.strokeLinecap) {
        canvasCtx!.lineCap = line.strokeLinecap as CanvasLineCap
      }

      canvasCtx!.beginPath()
      canvasCtx!.moveTo(line.x1, line.y1)
      canvasCtx!.lineTo(line.x2, line.y2)
      canvasCtx!.stroke()
    })

    // Reset
    canvasCtx.globalAlpha = 1
    canvasCtx.setLineDash([])
  }

  function drawXAxisLabel() {
    if (!canvasCtx) return

    canvasCtx.font = `${LAYOUT.LABEL_FONT_SIZE}px sans-serif`
    canvasCtx.fillStyle = '#000'
    canvasCtx.textAlign = 'center'
    canvasCtx.textBaseline = 'top'

    canvasCtx.fillText(
      xAxisLabel,
      LEFT_LABEL_WIDTH + plotAreaWidth / 2,
      chartHeight + 15
    )
  }

  // Legend constants
  const LEGEND = {
    TITLE_HEIGHT: 18,
    ITEM_HEIGHT: 15,
    ITEM_PADDING: 8,
    GROUP_SPACING: 10, // Increased for better separation between groups
    GROUP_TITLE_SPACING: 5, // Increased for better space between title and items
    ICON_WIDTH: 20,
    TEXT_PADDING: 8,
    ITEM_SPACING: 15,
    FONT_SIZE: 12,
    BG_HOVER_COLOR: 'rgba(0, 0, 0, 0.05)',
    RECT_HIGHLIGHT_STROKE: '#333333',
    RECT_HIGHLIGHT_STROKE_WIDTH: 1,
    LINE_HIGHLIGHT_STROKE_WIDTH: 3,
  }

  // Calculate legend items per row based on available width
  function getItemsPerRow() {
    if (!chartWidth || chartWidth <= 0) {
      return 3 // Default if no width provided
    }

    // Calculate how many items can fit in the available width with spacing
    const availableWidth = chartWidth - LEFT_LABEL_WIDTH - LAYOUT.PADDING * 2

    // Account for item width (icon + text + padding)
    // Use average text width estimation (approx 6px per character, assuming average item name length of 15 chars)
    const avgTextWidth = 90 // ~15 chars * 6px
    const itemFullWidth =
      LEGEND.ICON_WIDTH +
      LEGEND.TEXT_PADDING +
      avgTextWidth +
      LEGEND.ITEM_SPACING

    const maxItems = Math.floor(availableWidth / itemFullWidth)

    // Return at least 1 item per row, or as many as will fit
    return Math.max(1, maxItems)
  }

  // Calculate legend geometry - for rendering and hit detection
  function calculateLegendGeometry() {
    if (!data.stylingAndLegend) return { items: [], height: 0, groupTitles: [] }

    const itemsPerRow = getItemsPerRow()
    const legendX = LEFT_LABEL_WIDTH + LAYOUT.PADDING
    const legendY = chartHeight + LAYOUT.AXIS_LABEL_HEIGHT

    // Calculate rows for each section
    const aoiItemCount = data.stylingAndLegend.aoi.length
    const categoryItemCount = data.stylingAndLegend.category.length
    const visibilityItemCount = data.stylingAndLegend.visibility.length

    const aoiRows = Math.ceil(aoiItemCount / itemsPerRow)
    const categoryRows = Math.ceil(categoryItemCount / itemsPerRow)
    const visibilityRows =
      visibilityItemCount > 0 ? Math.ceil(visibilityItemCount / itemsPerRow) : 0

    // Group title positions - with proper spacing between title and items

    // Calculate heights with adequate spacing
    const aoiTitleY = legendY
    const aoiItemsStartY =
      aoiTitleY + LEGEND.TITLE_HEIGHT + LEGEND.GROUP_TITLE_SPACING
    const aoiSectionHeight =
      LEGEND.TITLE_HEIGHT +
      LEGEND.GROUP_TITLE_SPACING +
      aoiRows * (LEGEND.ITEM_HEIGHT + LEGEND.ITEM_PADDING)

    const categoryTitleY = aoiTitleY + aoiSectionHeight + LEGEND.GROUP_SPACING
    const categoryItemsStartY =
      categoryTitleY + LEGEND.TITLE_HEIGHT + LEGEND.GROUP_TITLE_SPACING
    const categorySectionHeight =
      LEGEND.TITLE_HEIGHT +
      LEGEND.GROUP_TITLE_SPACING +
      categoryRows * (LEGEND.ITEM_HEIGHT + LEGEND.ITEM_PADDING)

    const visibilityTitleY =
      visibilityItemCount > 0
        ? categoryTitleY + categorySectionHeight + LEGEND.GROUP_SPACING
        : 0
    const visibilityItemsStartY =
      visibilityItemCount > 0
        ? visibilityTitleY + LEGEND.TITLE_HEIGHT + LEGEND.GROUP_TITLE_SPACING
        : 0

    const visibilitySectionHeight =
      visibilityItemCount > 0
        ? LEGEND.TITLE_HEIGHT +
          LEGEND.GROUP_TITLE_SPACING +
          visibilityRows * (LEGEND.ITEM_HEIGHT + LEGEND.ITEM_PADDING)
        : 0

    // Store group titles for rendering
    const groupTitles: Array<{ title: string; x: number; y: number }> = [
      { title: 'Fixations', x: legendX, y: aoiTitleY },
      { title: 'Non-fixations', x: legendX, y: categoryTitleY },
    ]

    if (visibilityItemCount > 0) {
      groupTitles.push({
        title: 'AOI Visibility',
        x: legendX,
        y: visibilityTitleY,
      })
    }

    // Calculate total legend height
    const totalHeight =
      aoiSectionHeight +
      categorySectionHeight +
      visibilitySectionHeight +
      (visibilityItemCount > 0
        ? LEGEND.GROUP_SPACING * 2
        : LEGEND.GROUP_SPACING)

    // Generate geometry data for all legend items
    const items: Array<{
      identifier: string
      name: string
      color: string
      height: number
      x: number
      y: number
      width: number
      type: 'rect' | 'line'
      groupTitle: string
    }> = []

    // Calculate item width based on available space and items per row
    const availableWidth = chartWidth - legendX - LAYOUT.PADDING
    const itemWidth = Math.max(
      availableWidth / itemsPerRow - LEGEND.ITEM_SPACING,
      LEGEND.ICON_WIDTH + LEGEND.TEXT_PADDING + 60 // Minimum width for readability
    )

    // Add AOI items
    data.stylingAndLegend.aoi.forEach((item, i) => {
      const row = Math.floor(i / itemsPerRow)
      const col = i % itemsPerRow
      items.push({
        identifier: item.identifier,
        name: item.name,
        color: item.color,
        height: item.height,
        x: legendX + col * (itemWidth + LEGEND.ITEM_SPACING),
        y: aoiItemsStartY + row * (LEGEND.ITEM_HEIGHT + LEGEND.ITEM_PADDING),
        width: itemWidth,
        type: 'rect',
        groupTitle: 'Fixations',
      })
    })

    // Add Category items
    data.stylingAndLegend.category.forEach((item, i) => {
      const row = Math.floor(i / itemsPerRow)
      const col = i % itemsPerRow
      items.push({
        identifier: item.identifier,
        name: item.name,
        color: item.color,
        height: item.height,
        x: legendX + col * (itemWidth + LEGEND.ITEM_SPACING),
        y:
          categoryItemsStartY +
          row * (LEGEND.ITEM_HEIGHT + LEGEND.ITEM_PADDING),
        width: itemWidth,
        type: 'rect',
        groupTitle: 'Non-fixations',
      })
    })

    // Add Visibility items
    if (visibilityItemCount > 0) {
      data.stylingAndLegend.visibility.forEach((item, i) => {
        const row = Math.floor(i / itemsPerRow)
        const col = i % itemsPerRow
        items.push({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          height: item.height,
          x: legendX + col * (itemWidth + LEGEND.ITEM_SPACING),
          y:
            visibilityItemsStartY +
            row * (LEGEND.ITEM_HEIGHT + LEGEND.ITEM_PADDING),
          width: itemWidth,
          type: 'line',
          groupTitle: 'AOI Visibility',
        })
      })
    }

    return {
      items,
      groupTitles,
      height: totalHeight,
    }
  }

  // Draw the legend on the canvas
  function drawLegend() {
    if (!canvasCtx) return

    const legendGeometry = calculateLegendGeometry()

    // Skip legend if no content
    if (
      !legendGeometry ||
      !legendGeometry.items ||
      legendGeometry.items.length === 0
    )
      return

    // Draw group titles
    if (legendGeometry.groupTitles && legendGeometry.groupTitles.length > 0) {
      canvasCtx.font = `bold ${LEGEND.FONT_SIZE}px sans-serif`
      canvasCtx.fillStyle = '#000'
      canvasCtx.textAlign = 'left'
      canvasCtx.textBaseline = 'top'

      legendGeometry.groupTitles.forEach(group => {
        canvasCtx!.fillText(group.title, group.x, group.y)
      })
    }

    // Draw each legend item
    if (legendGeometry.items && legendGeometry.items.length > 0) {
      legendGeometry.items.forEach(item => {
        const isHighlighted = item.identifier === usedHighlight
        const anyHighlightActive = usedHighlight !== null

        // Set opacity based on highlight state
        if (anyHighlightActive) {
          canvasCtx!.globalAlpha = isHighlighted ? 1.0 : 0.15
        } else {
          canvasCtx!.globalAlpha = 1.0
        }

        // Draw item background (highlight or hover effect)
        if (isHighlighted) {
          canvasCtx!.fillStyle = LEGEND.BG_HOVER_COLOR
          canvasCtx!.fillRect(
            item.x - 5,
            item.y - 5,
            item.width + 5,
            LEGEND.ITEM_HEIGHT + 10
          )
        }

        // Draw the appropriate icon type (rect or line)
        if (item.type === 'rect') {
          canvasCtx!.fillStyle = item.color
          canvasCtx!.fillRect(
            item.x,
            item.y + (LEGEND.ITEM_HEIGHT - item.height) / 2,
            LEGEND.ICON_WIDTH,
            item.height
          )

          // Add stroke if highlighted
          if (isHighlighted) {
            canvasCtx!.strokeStyle = LEGEND.RECT_HIGHLIGHT_STROKE
            canvasCtx!.lineWidth = LEGEND.RECT_HIGHLIGHT_STROKE_WIDTH
            canvasCtx!.strokeRect(
              item.x,
              item.y + (LEGEND.ITEM_HEIGHT - item.height) / 2,
              LEGEND.ICON_WIDTH,
              item.height
            )
          }
        } else {
          // Draw line for visibility items
          canvasCtx!.strokeStyle = item.color
          canvasCtx!.lineWidth = isHighlighted
            ? LEGEND.LINE_HIGHLIGHT_STROKE_WIDTH
            : item.height

          if (!isHighlighted) {
            canvasCtx!.setLineDash([2, 2])
          } else {
            canvasCtx!.setLineDash([])
            canvasCtx!.lineCap = 'butt'
          }

          canvasCtx!.beginPath()
          canvasCtx!.moveTo(item.x, item.y + LEGEND.ITEM_HEIGHT / 2)
          canvasCtx!.lineTo(
            item.x + LEGEND.ICON_WIDTH,
            item.y + LEGEND.ITEM_HEIGHT / 2
          )
          canvasCtx!.stroke()

          // Reset dash array
          canvasCtx!.setLineDash([])
        }

        // Draw item text
        canvasCtx!.fillStyle = '#000'
        canvasCtx!.font = isHighlighted
          ? `bold ${LEGEND.FONT_SIZE}px sans-serif`
          : `${LEGEND.FONT_SIZE}px sans-serif`
        canvasCtx!.textAlign = 'start'
        canvasCtx!.textBaseline = 'alphabetic'

        // Truncate text if too long
        const truncatedName = truncateText(item.name)
        canvasCtx!.fillText(
          truncatedName,
          item.x + LEGEND.ICON_WIDTH + LEGEND.TEXT_PADDING,
          item.y + LEGEND.ITEM_HEIGHT - 4
        )
      })
    }

    // Reset opacity
    canvasCtx.globalAlpha = 1.0
  }

  // Helper to truncate text if too long
  function truncateText(text: string, maxLength = 12) {
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text
  }

  // Check if a mouse click or hover is on a legend item
  function isMouseOverLegendItem(mouseX: number, mouseY: number) {
    if (!data.stylingAndLegend) return null

    const legendGeometry = calculateLegendGeometry()

    // Check each legend item
    for (const item of legendGeometry.items) {
      // Add some padding for easier clicking
      if (
        mouseX >= item.x - 5 &&
        mouseX <= item.x + item.width + 5 &&
        mouseY >= item.y - 5 &&
        mouseY <= item.y + LEGEND.ITEM_HEIGHT + 5
      ) {
        return item
      }
    }

    return null
  }

  // Mouse event handling for canvas
  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return

    // Get mouse position relative to the canvas with pixel ratio correction
    const rect = canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / pixelRatio
    const mouseY = (event.clientY - rect.top) / pixelRatio

    lastMouseX = mouseX
    lastMouseY = mouseY

    // Check if mouse is over a legend item
    const hoveredLegendItem = isMouseOverLegendItem(mouseX, mouseY)
    if (hoveredLegendItem) {
      canvas.style.cursor = 'pointer'
      return
    }

    // Check if mouse is in the draggable area
    const inDraggableArea =
      mouseX >= LEFT_LABEL_WIDTH &&
      mouseX <= LEFT_LABEL_WIDTH + plotAreaWidth &&
      mouseY >= 0 &&
      mouseY <= data.participants.length * data.heightOfBarWrap

    // Update cursor based on dragging state and location
    if (isDragging) {
      canvas.style.cursor = 'grabbing'
    } else if (inDraggableArea && !isHoveringSegment) {
      canvas.style.cursor = 'grab'
    } else {
      canvas.style.cursor = 'default'
    }

    // Find the segment under the mouse pointer
    const hoveredSegment = rectangleSegments.find(
      rect =>
        mouseX >= rect.x &&
        mouseX <= rect.x + rect.width &&
        mouseY >= rect.y &&
        mouseY <= rect.y + rect.height
    )

    // If hovering over a new segment, handle it
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

      // Set hovering state to true
      isHoveringSegment = true

      // Clear any existing timeout
      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
        hoverTimeout = null
      }

      const XUnderTheRect = event.clientX + window.scrollX + 5
      const YUnderTheRect =
        hoveredSegment.y + hoveredSegment.height + rect.top + window.scrollY + 5

      onTooltipActivation({
        segmentOrderId: hoveredSegment.orderId,
        participantId: hoveredSegment.participantId,
        x: XUnderTheRect,
        y: YUnderTheRect,
      })
    } else if (!hoveredSegment && currentHoveredSegment) {
      // If moved out of a segment but still in canvas
      currentHoveredSegment = null
      onTooltipDeactivation()

      // Set delayed reset of hovering state
      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
      }

      hoverTimeout = window.setTimeout(() => {
        isHoveringSegment = false
        hoverTimeout = null
      }, 150) // Keep default cursor for 150ms after leaving segment
    }
  }

  function handleMouseLeave() {
    // If there was a hovered segment, log that hover has stopped
    if (currentHoveredSegment) {
      currentHoveredSegment = null
      onTooltipDeactivation()

      // Set delayed reset of hovering state
      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
      }

      hoverTimeout = window.setTimeout(() => {
        isHoveringSegment = false
        hoverTimeout = null
      }, 150) // Keep default cursor for 150ms after leaving segment
    }

    // Reset dragging if mouse leaves during drag
    if (isDragging) {
      isDragging = false
    }
  }

  // Drag handlers
  function handleMouseDown(event: MouseEvent) {
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / pixelRatio
    const mouseY = (event.clientY - rect.top) / pixelRatio

    // Check if clicking on a legend item
    const clickedLegendItem = isMouseOverLegendItem(mouseX, mouseY)
    if (clickedLegendItem) {
      // Handle legend item click
      handleLegendIdentifier(clickedLegendItem.identifier)
      return
    }

    // Only start drag in the chart area
    if (
      mouseX >= LEFT_LABEL_WIDTH &&
      mouseX <= LEFT_LABEL_WIDTH + plotAreaWidth &&
      mouseY >= 0 &&
      mouseY <= data.participants.length * data.heightOfBarWrap &&
      !isHoveringSegment
    ) {
      isDragging = true
      dragStartX = mouseX
      canvas.style.cursor = 'grabbing'
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false
      if (canvas) {
        canvas.style.cursor = 'grab'
      }
    }
  }

  function handleDrag(event: MouseEvent) {
    if (!isDragging || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / pixelRatio
    const mouseY = (event.clientY - rect.top) / pixelRatio

    // Check if mouse is over legend - stop dragging if it is
    const hoveredLegendItem = isMouseOverLegendItem(mouseX, mouseY)
    if (hoveredLegendItem) {
      isDragging = false
      canvas.style.cursor = 'pointer'
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

  // Lifecycle hooks
  onMount(() => {
    setupCanvas()

    // Add global event listeners for drag handling
    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleDrag)
      window.removeEventListener('mouseup', handleMouseUp)

      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
      }
    }
  })

  // Create direct dependencies on key data properties to ensure canvas updates
  // when any of these values change
  $effect(() => {
    // These direct references create dependencies on data changes
    const _ = [
      data.chartHeight,
      data.heightOfBarWrap,
      data.participants.length,
      totalHeight,
      totalWidth,
      chartHeight,
      highlightedIdentifier,
      usedHighlight,
      // Reference timeline data to update when it changes
      data.timeline.ticks.length,
    ]

    if (canvas && canvasCtx) {
      // Always resize the canvas when dimensions change
      resizeCanvas()
      // Always redraw after changes
      renderCanvas()
    }
  })
</script>

<figure class="plot-container" id={scarfPlotAreaId}>
  <canvas
    class="scarf-plot-figure"
    width={totalWidth}
    height={totalHeight}
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
    on:mousedown={handleMouseDown}
    bind:this={canvas}
    data-component="scarfplot"
    role="img"
    aria-label="Scarf plot visualization"
  ></canvas>
</figure>

<style>
  .plot-container {
    margin: 0;
    padding: 0;
    cursor: default;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .scarf-plot-figure {
    font-family: sans-serif;
    display: block;
  }
</style>
