<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { addInfoToast } from '$lib/stores/toastStore'
  import { calculateLabelOffset } from '$lib/components/Plot/utils/textUtils'
  import { draggable } from '$lib/actions/draggable'
  import { fadeIn } from '$lib/actions/fadeIn'
  import { onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    SCARF_LAYOUT,
    getItemsPerRow,
    getXAxisLabel,
    getTimelineUnit,
  } from '$lib/services/scarfServices'
  import {
    createCanvasState,
    setupCanvas,
    resizeCanvas,
    getScaledMousePosition,
    getTooltipPosition,
    setupDpiChangeListeners,
    beginCanvasDrawing,
    finishCanvasDrawing,
    type CanvasState,
  } from '$lib/utils/canvasUtils'

  // CONSTANTS - layout dimensions and styling
  const LAYOUT = SCARF_LAYOUT

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
    calculatedHeights: {
      participantBarHeight: number
      heightOfParticipantBars: number
      chartHeight: number
      legendHeight: number
      totalHeight: number
      axisLabelY: number
      legendY: number
    }
    dpiOverride?: number | null // Override for DPI settings when exporting
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
    calculatedHeights,
    dpiOverride = null,
  }: Props = $props()

  // Legend constants
  const LEGEND = {
    TITLE_HEIGHT: LAYOUT.LEGEND_TITLE_HEIGHT,
    ITEM_HEIGHT: LAYOUT.LEGEND_ITEM_HEIGHT,
    ITEM_PADDING: LAYOUT.LEGEND_ITEM_PADDING,
    GROUP_SPACING: LAYOUT.LEGEND_GROUP_SPACING,
    GROUP_TITLE_SPACING: LAYOUT.LEGEND_GROUP_TITLE_SPACING,
    ICON_WIDTH: LAYOUT.LEGEND_ICON_WIDTH,
    TEXT_PADDING: LAYOUT.LEGEND_TEXT_PADDING,
    ITEM_SPACING: LAYOUT.LEGEND_ITEM_SPACING,
    FONT_SIZE: LAYOUT.LEGEND_FONT_SIZE,
    BG_HOVER_COLOR: LAYOUT.LEGEND_BG_HOVER_COLOR,
    RECT_HIGHLIGHT_STROKE: LAYOUT.LEGEND_RECT_HIGHLIGHT_STROKE,
    RECT_HIGHLIGHT_STROKE_WIDTH: LAYOUT.LEGEND_RECT_HIGHLIGHT_STROKE_WIDTH,
    LINE_HIGHLIGHT_STROKE_WIDTH: LAYOUT.LEGEND_LINE_HIGHLIGHT_STROKE_WIDTH,
    ITEMS_PER_ROW: LAYOUT.LEGEND_ITEMS_PER_ROW,
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
  let canvasState = $state<CanvasState>(createCanvasState())
  let dragStartX = $state(0) // Track drag start position

  // Derived values using Svelte 5 $derived rune
  const usedHighlight = $derived(fixedHighlight ?? highlightedIdentifier)
  const xAxisLabel = $derived(getXAxisLabel(settings.timeline))

  // Add derived stores for data properties
  const heightOfBarWrap = $derived(data.heightOfBarWrap)
  const participantCount = $derived(data.participants.length)
  const tickCount = $derived(data.timeline.ticks.length)

  // Memoize legend geometry to avoid recalculating on every mouse move
  const legendGeometry = $derived.by(() => {
    if (!data.stylingAndLegend) return { items: [], height: 0, groupTitles: [] }
    return calculateLegendGeometry()
  })

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
      chartWidth -
        LEFT_LABEL_WIDTH -
        (LAYOUT.PADDING << 1) -
        LAYOUT.RIGHT_MARGIN
    )
  )

  const totalHeight = $derived(calculatedHeights.totalHeight)

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

    // Use the pre-flattened rectangles for performance
    return data.flattenedRectangles.map(rect => {
      const identifier = rect.identifier
      const isHighlighted = identifier === usedHighlight
      const style = getStyleForRect(identifier, isHighlighted)

      // Calculate final screen position from raw values
      return {
        identifier: identifier,
        height: rect.height,
        x: LEFT_LABEL_WIDTH + rect.rawX * plotAreaWidth,
        y: rect.y,
        width: rect.rawWidth * plotAreaWidth,
        participantId: rect.participantId,
        segmentId: rect.segmentId,
        orderId: rect.orderId,
        // Include style properties
        fill: style.fill,
        opacity: style.opacity ?? 1,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
      }
    })
  })

  const lineSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return []

    // Use the pre-flattened lines for performance
    return data.flattenedLines.map(line => {
      const identifier = line.identifier
      const isHighlighted = identifier === usedHighlight
      const style = getStyleForLine(identifier, isHighlighted)

      return {
        identifier: identifier,
        x1: LEFT_LABEL_WIDTH + line.rawX1 * plotAreaWidth,
        y1: line.y,
        x2: LEFT_LABEL_WIDTH + line.rawX2 * plotAreaWidth,
        y2: line.y,
        participantId: line.participantId,
        // Include style properties
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        opacity: style.opacity ?? 1,
        strokeDasharray: style.strokeDasharray,
        strokeLinecap: style.strokeLinecap,
      }
    })
  })

  // Interaction handlers
  function handleFixedHighlight(identifier: string) {
    if (fixedHighlight === identifier) {
      // If already highlighted, clear it
      fixedHighlight = null
      highlightedIdentifier = null
      //renderCanvas() // Redraw canvas
      return
    }

    // Otherwise, set the fixed highlight
    fixedHighlight = identifier
    addInfoToast(`Highlight fixed. Click the same item in the legend to remove`)
    //renderCanvas() // Redraw canvas
  }

  function handleLegendIdentifier(identifier: string) {
    // Handle both local fixed highlight and external app state
    handleFixedHighlight(identifier)
    onLegendClick(identifier)
  }

  // Canvas drawing functions
  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)

    // Get context from state
    const ctx = canvasState.context
    if (!ctx) return

    // Draw participant labels (Left Side)
    drawParticipantLabels(ctx)

    // Draw horizontal grid lines
    drawHorizontalGridLines(ctx)

    // Draw timeline axis labels and ticks
    drawTimelineLabels(ctx)

    // Draw X-Axis ticks and bottom border
    drawXAxisTicksAndBorder(ctx)

    // Draw rectangle segments
    drawRectangles(ctx)

    // Draw line segments
    drawLines(ctx)

    // Draw X-Axis label
    drawXAxisLabel(ctx)

    // Draw the legend
    drawLegend(ctx)

    finishCanvasDrawing(canvasState)
  }

  function drawParticipantLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = `${LAYOUT.LABEL_FONT_SIZE}px sans-serif`
    ctx.fillStyle = '#000'
    ctx.textAlign = 'start'
    ctx.textBaseline = 'middle'

    data.participants.forEach((participant, i) => {
      ctx.fillText(
        participant.label,
        LAYOUT.PADDING,
        i * data.heightOfBarWrap + (data.heightOfBarWrap >> 1)
      )
    })
  }

  function drawHorizontalGridLines(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = LAYOUT.GRID_COLOR
    ctx.lineWidth = LAYOUT.GRID_STROKE_WIDTH

    data.participants.forEach((_, i) => {
      // Draw grid lines exactly at bar boundaries
      const y = i * calculatedHeights.participantBarHeight
      ctx.beginPath()
      ctx.moveTo(LEFT_LABEL_WIDTH, y)
      ctx.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth, y)
      ctx.stroke()
    })

    // Draw final grid line at the bottom
    const y = calculatedHeights.heightOfParticipantBars
    ctx.beginPath()
    ctx.moveTo(LEFT_LABEL_WIDTH, y)
    ctx.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth, y)
    ctx.stroke()
  }

  function drawTimelineLabels(ctx: CanvasRenderingContext2D) {
    if (data.timeline.ticks.length === 0) return

    ctx.font = `${LAYOUT.LABEL_FONT_SIZE}px sans-serif`
    ctx.fillStyle = '#000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'hanging'

    // Position labels just 5px below the participant bars
    const yPos = calculatedHeights.heightOfParticipantBars + 10

    data.timeline.ticks.forEach(tick => {
      if (tick.isNice) {
        ctx.fillText(
          tick.label,
          LEFT_LABEL_WIDTH + tick.position * plotAreaWidth,
          yPos
        )
      }
    })
  }

  function drawXAxisTicksAndBorder(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = LAYOUT.GRID_COLOR
    ctx.lineWidth = 1.5

    // Use the exact height from calculatedHeights
    const yLine = calculatedHeights.heightOfParticipantBars

    // Draw ticks - make them shorter (3px instead of LAYOUT.TICK_LENGTH)
    data.timeline.ticks.forEach(tick => {
      const x = LEFT_LABEL_WIDTH + tick.position * plotAreaWidth
      const y1 = yLine
      const y2 = y1 + 5

      ctx.beginPath()
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
      ctx.stroke()
    })

    // Draw bottom border line
    ctx.beginPath()
    ctx.moveTo(LEFT_LABEL_WIDTH, yLine)
    ctx.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth, yLine)
    ctx.stroke()
  }

  function drawRectangles(ctx: CanvasRenderingContext2D) {
    rectangleSegments.forEach(rect => {
      ctx.globalAlpha = rect.opacity
      ctx.fillStyle = rect.fill

      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)

      if (rect.stroke) {
        ctx.strokeStyle = rect.stroke
        ctx.lineWidth = rect.strokeWidth || 1
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      }
    })

    ctx.globalAlpha = 1
  }

  function drawLines(ctx: CanvasRenderingContext2D) {
    lineSegments.forEach(line => {
      ctx.globalAlpha = line.opacity
      ctx.strokeStyle = line.stroke
      ctx.lineWidth = line.strokeWidth

      // Handle line dash
      if (line.strokeDasharray && line.strokeDasharray !== 'none') {
        ctx.setLineDash([2, 2]) // Simple dash pattern
      } else {
        ctx.setLineDash([])
      }

      // Handle line cap
      if (line.strokeLinecap) {
        ctx.lineCap = line.strokeLinecap as CanvasLineCap
      }

      ctx.beginPath()
      ctx.moveTo(line.x1, line.y1)
      ctx.lineTo(line.x2, line.y2)
      ctx.stroke()
    })

    // Reset
    ctx.globalAlpha = 1
    ctx.setLineDash([])
  }

  function drawXAxisLabel(ctx: CanvasRenderingContext2D) {
    ctx.font = `${LAYOUT.LABEL_FONT_SIZE}px sans-serif`
    ctx.fillStyle = '#000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Position the label using exact coordinates from calculatedHeights
    const labelY = calculatedHeights.axisLabelY

    ctx.fillText(xAxisLabel, LEFT_LABEL_WIDTH + (plotAreaWidth >> 1), labelY)
  }

  // Calculate legend geometry - for rendering and hit detection
  function calculateLegendGeometry() {
    if (!data.stylingAndLegend) return { items: [], height: 0, groupTitles: [] }

    const itemsPerRow = getItemsPerRow({
      chartWidth,
      leftLabelWidth: LEFT_LABEL_WIDTH,
      padding: LAYOUT.PADDING,
      iconWidth: LEGEND.ICON_WIDTH,
      textPadding: LEGEND.TEXT_PADDING,
      itemSpacing: LEGEND.ITEM_SPACING,
    })

    // Use exact coordinates from calculatedHeights
    const legendX = LEFT_LABEL_WIDTH + LAYOUT.PADDING
    const legendY = calculatedHeights.legendY

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
        ? LEGEND.GROUP_SPACING << 1
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
  function drawLegend(ctx: CanvasRenderingContext2D) {
    // Skip legend if no content
    if (
      !legendGeometry ||
      !legendGeometry.items ||
      legendGeometry.items.length === 0
    )
      return

    // Draw group titles
    if (legendGeometry.groupTitles && legendGeometry.groupTitles.length > 0) {
      ctx.font = `bold ${LEGEND.FONT_SIZE}px sans-serif`
      ctx.fillStyle = '#000'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      legendGeometry.groupTitles.forEach(group => {
        ctx.fillText(group.title, group.x, group.y)
      })
    }

    // Draw each legend item
    if (legendGeometry.items && legendGeometry.items.length > 0) {
      legendGeometry.items.forEach(item => {
        const isHighlighted = item.identifier === usedHighlight
        const anyHighlightActive = usedHighlight !== null

        // Set opacity based on highlight state
        if (anyHighlightActive) {
          ctx.globalAlpha = isHighlighted ? 1.0 : 0.15
        } else {
          ctx.globalAlpha = 1.0
        }

        // Draw item background (highlight or hover effect)
        if (isHighlighted) {
          ctx.fillStyle = LEGEND.BG_HOVER_COLOR
          ctx.fillRect(
            item.x - 5,
            item.y - 5,
            item.width + 5,
            LEGEND.ITEM_HEIGHT + 10
          )
        }

        // Draw the appropriate icon type (rect or line)
        if (item.type === 'rect') {
          ctx.fillStyle = item.color
          ctx.fillRect(
            item.x,
            item.y + ((LEGEND.ITEM_HEIGHT - item.height) >> 1),
            LEGEND.ICON_WIDTH,
            item.height
          )

          // Add stroke if highlighted
          if (isHighlighted) {
            ctx.strokeStyle = LEGEND.RECT_HIGHLIGHT_STROKE
            ctx.lineWidth = LEGEND.RECT_HIGHLIGHT_STROKE_WIDTH
            ctx.strokeRect(
              item.x,
              item.y + ((LEGEND.ITEM_HEIGHT - item.height) >> 1),
              LEGEND.ICON_WIDTH,
              item.height
            )
          }
        } else {
          // Draw line for visibility items
          ctx.strokeStyle = item.color
          ctx.lineWidth = isHighlighted
            ? LEGEND.LINE_HIGHLIGHT_STROKE_WIDTH
            : item.height

          if (!isHighlighted) {
            ctx.setLineDash([2, 2])
          } else {
            ctx.setLineDash([])
            ctx.lineCap = 'butt'
          }

          ctx.beginPath()
          ctx.moveTo(item.x, item.y + (LEGEND.ITEM_HEIGHT >> 1))
          ctx.lineTo(
            item.x + LEGEND.ICON_WIDTH,
            item.y + (LEGEND.ITEM_HEIGHT >> 1)
          )
          ctx.stroke()

          // Reset dash array
          ctx.setLineDash([])
        }

        // Draw item text
        ctx.fillStyle = '#000'
        ctx.font = isHighlighted
          ? `bold ${LEGEND.FONT_SIZE}px sans-serif`
          : `${LEGEND.FONT_SIZE}px sans-serif`
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'

        // Truncate text if too long
        const truncatedName = truncateText(item.name)
        ctx.fillText(
          truncatedName,
          item.x + LEGEND.ICON_WIDTH + LEGEND.TEXT_PADDING,
          item.y + LEGEND.ITEM_HEIGHT - 4
        )
      })
    }

    // Reset opacity
    ctx.globalAlpha = 1.0
  }

  // Helper to truncate text if too long
  function truncateText(text: string, maxLength = 12) {
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text
  }

  // Check if a mouse click or hover is on a legend item
  function isMouseOverLegendItem(mouseX: number, mouseY: number) {
    if (!data.stylingAndLegend) return null

    // Use the memoized legend geometry
    const items = legendGeometry.items

    // Check each legend item
    for (const item of items) {
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

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

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

      // Get consistent tooltip position
      const tooltipPos = getTooltipPosition(
        canvasState,
        hoveredSegment.x + hoveredSegment.width,
        hoveredSegment.y + (hoveredSegment.height >> 1),
        { x: 5, y: 0 }
      )

      onTooltipActivation({
        segmentOrderId: hoveredSegment.orderId,
        participantId: hoveredSegment.participantId,
        x: tooltipPos.x,
        y: tooltipPos.y,
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

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

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

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

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

  // Create a render scheduler
  function scheduleRender() {
    //console.log('scheduleRender', new Date().toISOString())
    if (!canvasState.renderScheduled && browser) {
      canvasState.renderScheduled = true
      requestAnimationFrame(() => {
        renderCanvas()
        canvasState.renderScheduled = false
      })
    }
  }

  // Lifecycle hooks
  onMount(() => {
    if (canvas) {
      // Initialize canvas with our utility
      canvasState = setupCanvas(canvasState, canvas, dpiOverride)

      // Resize and render initially
      canvasState = resizeCanvas(canvasState, totalWidth, totalHeight)
      renderCanvas()

      // Setup DPI and position change listeners with proper state management
      const cleanup = setupDpiChangeListeners(
        // State getter function that always returns the current state
        () => canvasState,
        // State setter function to properly update the state
        newState => {
          canvasState = newState
          // Resize with new pixel ratio if it changed
          if (canvasState.canvas) {
            canvasState = resizeCanvas(canvasState, totalWidth, totalHeight)
            renderCanvas() // Ensure canvas redraws after state update
          }
        },
        dpiOverride,
        renderCanvas
      )

      // Add global event listeners for drag handling
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleMouseUp)

      return () => {
        cleanup()
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleMouseUp)

        if (hoverTimeout !== null) {
          window.clearTimeout(hoverTimeout)
        }
      }
    }
  })

  // Create direct dependencies on key data properties to ensure canvas updates
  // when any of these values change
  $effect(() => {
    // These derived values will only trigger the effect when they actually change
    // These direct references create dependencies on data changes
    const _ = [
      data,
      settings,
      totalWidth,
      // Reference timeline data to update when it changes
      highlightedIdentifier,
      usedHighlight,
      chartWidth,
    ]

    // Schedule a render instead of immediate execution
    untrack(() => {
      resizeCanvas(canvasState, totalWidth, totalHeight)
      scheduleRender()
    })
  })
</script>

<canvas
  class="scarf-plot-figure"
  use:fadeIn
  width={totalWidth}
  height={totalHeight}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onmousedown={handleMouseDown}
  bind:this={canvas}
  data-component="scarfplot"
  aria-label="Scarf plot visualization"
></canvas>

<style>
  .scarf-plot-figure {
    font-family: sans-serif;
    display: block;
  }
</style>
