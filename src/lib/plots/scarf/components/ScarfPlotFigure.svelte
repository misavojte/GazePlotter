<script lang="ts">
  import type { ScarfFillingType } from '$lib/plots/scarf/types'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import { addInfoToast } from '$lib/toaster'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
    SYSTEM_SANS_SERIF_STACK,
    estimateTextWidth,
  } from '$lib/shared/utils/textUtils'
  import { onMount, onDestroy, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    SCARF_LAYOUT,
    getItemsPerRow,
    getXAxisLabel,
  } from '$lib/plots/scarf/utils/scarfServices'
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
  } from '$lib/shared/utils/canvasUtils'
  import { updateTooltip } from '$lib/tooltip'

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
    onDragEnd?: () => void
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
    highlightedIdentifier = null,
    onLegendClick = () => {},
    onTooltipActivation = () => {},
    onTooltipDeactivation = () => {},
    onDragStepX = () => {},
    onDragEnd = () => {},
    chartWidth = 0,
    calculatedHeights,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
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
  let dragStartY = $state(0) // Track drag start position
  let hasDragStarted = $state(false) // Track if drag threshold has been exceeded
  let preparedForDragging = $state(false) // Track if prepared for dragging (shows draggable cursor)
  let hoveredLegendItem = $state<any>(null) // Track currently hovered legend item

  // Derived values using Svelte 5 $derived rune
  const usedHighlight = $derived(fixedHighlight ?? highlightedIdentifier)
  const xAxisLabel = $derived(getXAxisLabel(settings.timeline))

  // Memoize legend geometry to avoid recalculating on every mouse move
  const legendGeometry = $derived.by(() => {
    if (!data.stylingAndLegend) return { items: [], height: 0, groupTitles: [] }
    return calculateLegendGeometry()
  })

  // SVG size calculations - MOVE THESE BEFORE RECTANGLE/LINE CALCULATIONS
  const totalWidth = $derived(chartWidth + marginLeft + marginRight)

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

  const totalHeight = $derived(
    calculatedHeights.totalHeight + marginTop + marginBottom
  )

  // Create a unified identifier mapping system for all style types
  // Using a single integer id space for maximum performance
  const identifierSystem = $derived.by(() => {
    // Create fast lookup maps
    const idToIndex = new Map<string, number>()
    const indexToId = new Map<number, string>()
    const idToType = new Map<string, 'aoi' | 'category' | 'visibility'>()

    // Track if we need to check for overlap (same identifier in multiple types)
    let hasOverlap = false
    const allIdentifiers = new Set<string>()

    // Count total identifiers to pre-allocate arrays
    let totalIdentifiers = 0
    let aoiCount = 0
    let categoryCount = 0
    let visibilityCount = 0

    if (data.stylingAndLegend) {
      totalIdentifiers =
        data.stylingAndLegend.aoi.length +
        data.stylingAndLegend.category.length +
        data.stylingAndLegend.visibility.length

      aoiCount = data.stylingAndLegend.aoi.length
      categoryCount = data.stylingAndLegend.category.length
      visibilityCount = data.stylingAndLegend.visibility.length

      // Populate maps with sequential indices
      let idx = 0

      // First handle AOI styles (typically most numerous)
      for (const style of data.stylingAndLegend.aoi) {
        indexToId.set(idx, style.identifier)
        idToIndex.set(style.identifier, idx++)
        idToType.set(style.identifier, 'aoi')

        // Check for potential overlap
        if (allIdentifiers.has(style.identifier)) {
          hasOverlap = true
        } else {
          allIdentifiers.add(style.identifier)
        }
      }

      // Then category styles
      for (const style of data.stylingAndLegend.category) {
        indexToId.set(idx, style.identifier)
        idToIndex.set(style.identifier, idx++)
        idToType.set(style.identifier, 'category')

        // Check for potential overlap
        if (allIdentifiers.has(style.identifier)) {
          hasOverlap = true
        } else {
          allIdentifiers.add(style.identifier)
        }
      }

      // Finally visibility styles
      for (const style of data.stylingAndLegend.visibility) {
        indexToId.set(idx, style.identifier)
        idToIndex.set(style.identifier, idx++)
        idToType.set(style.identifier, 'visibility')

        // Check for potential overlap
        if (allIdentifiers.has(style.identifier)) {
          hasOverlap = true
        } else {
          allIdentifiers.add(style.identifier)
        }
      }
    }

    // Return complete identifier system for fast lookups
    return {
      idToIndex,
      indexToId,
      idToType,
      hasOverlap,
      totalIdentifiers,
      counts: {
        aoi: aoiCount,
        category: categoryCount,
        visibility: visibilityCount,
      },
    }
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

  const lineStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()
    const visibility = data.stylingAndLegend.visibility
    const len = visibility.length

    // Pre-compute all line styles (visibility) with dimmed state
    for (let i = 0; i < len; i++) {
      const style = visibility[i]
      const baseStyle = {
        stroke: style.color,
        strokeWidth: style.height,
        strokeDasharray: '1',
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

  // Separate derived stores for rectangle and line segments
  const rectangleSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return new Float32Array(0)

    // Use the pre-flattened rectangles for performance
    const segments = data.flattenedRectangles
    const len = segments.length

    // Each rect needs: x, y, width, height, identifierIndex, participantId, segmentId, orderId, styleData
    // 12 values per rectangle
    const RECT_STRIDE = 12
    const buffer = new Float32Array(len * RECT_STRIDE)

    const isUsedHighlight = usedHighlight !== null
    // Get fast lookup maps
    const { idToIndex } = identifierSystem

    // Process all rectangles in a single loop for best performance
    for (let i = 0; i < len; i++) {
      const rect = segments[i]
      const idx = i * RECT_STRIDE
      const identifier = rect.identifier

      // Get style index - must exist in the map
      const identifierIdx = idToIndex.get(identifier) ?? 0

      // Calculate x and width based on the plot area - done once per rect
      const x = LEFT_LABEL_WIDTH + rect.rawX * plotAreaWidth + marginLeft
      const width = rect.rawWidth * plotAreaWidth
      const y = rect.y + marginTop

      // Store basic geometry
      buffer[idx] = x // x
      buffer[idx + 1] = y // y
      buffer[idx + 2] = width // width
      buffer[idx + 3] = rect.height // height
      buffer[idx + 4] = identifierIdx // identifier index
      buffer[idx + 5] = rect.participantId // participantId
      buffer[idx + 6] = rect.segmentId // segmentId
      buffer[idx + 7] = rect.orderId // orderId

      // Style flags - compute only once
      const isDimmed = isUsedHighlight && identifier !== usedHighlight

      // 8: dimmed (0/1)
      buffer[idx + 8] = isDimmed ? 1 : 0

      // 9-11: reserved for future use
      buffer[idx + 9] = 0
      buffer[idx + 10] = 0
      buffer[idx + 11] = 0
    }

    return buffer
  })

  const lineSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return new Float32Array(0)

    // Use the pre-flattened lines for performance
    const segments = data.flattenedLines
    const len = segments.length

    // Each line needs: x1, y1, x2, y2, identifierIndex, participantId, styleData
    // 10 values per line
    const LINE_STRIDE = 10
    const buffer = new Float32Array(len * LINE_STRIDE)

    const isUsedHighlight = usedHighlight !== null
    // Get fast lookup maps
    const { idToIndex } = identifierSystem

    // Process all lines in a single loop for best performance
    for (let i = 0; i < len; i++) {
      const line = segments[i]
      const idx = i * LINE_STRIDE
      const identifier = line.identifier

      // Get style index - must exist in the map
      const identifierIdx = idToIndex.get(identifier) ?? 0

      // Calculate coordinates based on the plot area - done once per line
      const x1 = LEFT_LABEL_WIDTH + line.rawX1 * plotAreaWidth + marginLeft
      const x2 = LEFT_LABEL_WIDTH + line.rawX2 * plotAreaWidth + marginLeft
      const y = line.y + marginTop

      // Store basic geometry
      buffer[idx] = x1 // x1
      buffer[idx + 1] = y // y1
      buffer[idx + 2] = x2 // x2
      buffer[idx + 3] = y // y2
      buffer[idx + 4] = identifierIdx // identifier index
      buffer[idx + 5] = line.participantId // participantId

      // Style flags - compute only once
      const isDimmed = isUsedHighlight && identifier !== usedHighlight

      // 6: dimmed (0/1)
      buffer[idx + 6] = isDimmed ? 1 : 0

      // 7-9: reserved for future use
      buffer[idx + 7] = 0
      buffer[idx + 8] = 0
      buffer[idx + 9] = 0
    }

    return buffer
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

    // Set up font
    setUpFont(ctx)

    // Draw participant labels (Left Side)
    drawParticipantLabels(ctx)

    // Draw timeline axis labels and ticks
    drawTimelineLabels(ctx)

    // Draw X-Axis label
    drawXAxisLabel(ctx)

    // Draw legend item texts
    drawLegendItemTexts(ctx)

    // Draw legend group titles
    drawLegendGroupTitles(ctx)

    // ---- STOP OF TEXT DRAWING ---- //

    // Draw horizontal grid lines
    drawHorizontalGridLines(ctx)

    // Draw X-Axis ticks and bottom border
    drawXAxisTicksAndBorder(ctx)

    // Draw rectangle segments
    drawRectangles(ctx)

    // Draw line segments
    drawLines(ctx)

    // Draw the legend
    drawLegend(ctx)

    finishCanvasDrawing(canvasState)
  }

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `${LAYOUT.LABEL_FONT_SIZE}px ${SYSTEM_SANS_SERIF_STACK}`
    // avoid full black color, use a nearly black color
    ctx.fillStyle = '#222'
  }

  function drawParticipantLabels(ctx: CanvasRenderingContext2D) {
   
    // watch out that setUpFont function is called before this function is called!

    ctx.textAlign = 'start'
    ctx.textBaseline = 'middle'

    const participants = data.participants
    const len = participants.length

    for (let i = 0; i < len; i++) {
      const participant = participants[i]
      ctx.fillText(
        participant.label,
        LAYOUT.PADDING + marginLeft,
        i * data.heightOfBarWrap + (data.heightOfBarWrap >> 1) + marginTop
      )
    }
  }

  function drawHorizontalGridLines(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = LAYOUT.GRID_COLOR
    ctx.lineWidth = LAYOUT.GRID_STROKE_WIDTH

    const participants = data.participants
    const len = participants.length

    for (let i = 0; i < len; i++) {
      // Draw grid lines exactly at bar boundaries
      const y = i * calculatedHeights.participantBarHeight + marginTop
      ctx.beginPath()
      ctx.moveTo(LEFT_LABEL_WIDTH + marginLeft, y)
      ctx.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft, y)
      ctx.stroke()
    }

    // Draw final grid line at the bottom
    const y = calculatedHeights.heightOfParticipantBars + marginTop
    ctx.beginPath()
    ctx.moveTo(LEFT_LABEL_WIDTH + marginLeft, y)
    ctx.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft, y)
    ctx.stroke()
  }

  function drawTimelineLabels(ctx: CanvasRenderingContext2D) {
    // watch out that setUpFont function is called before this function is called!

    const ticks = data.timeline.ticks
    const len = ticks.length
    if (len === 0) return

    ctx.textAlign = 'center'
    ctx.textBaseline = 'hanging'

    // Position labels just 5px below the participant bars
    const yPos = calculatedHeights.heightOfParticipantBars + 10 + marginTop
    const rightBoundary = LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft
    const isSecondToLast = len - 2

    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      if (!tick.isNice) continue

      const regularXPos = LEFT_LABEL_WIDTH + tick.position * plotAreaWidth + marginLeft
      
      // Only check for overflow on the second-to-last tick
      if (i === isSecondToLast) {
        const textWidth = ctx.measureText(tick.label).width
        const rightEdgeOfText = regularXPos + textWidth / 2
        
        if (rightEdgeOfText > rightBoundary) {
          // Move the label left just enough so it fits within the plot area
          const xPos = regularXPos - (rightEdgeOfText - rightBoundary)
          ctx.fillText(tick.label, xPos, yPos)
        } else {
          ctx.fillText(tick.label, regularXPos, yPos)
        }
      } else {
        ctx.fillText(tick.label, regularXPos, yPos)
      }
    }
  }

  function drawXAxisTicksAndBorder(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = LAYOUT.GRID_COLOR
    ctx.lineWidth = 1.5

    // Use the exact height from calculatedHeights
    const yLine = calculatedHeights.heightOfParticipantBars + marginTop
    const ticks = data.timeline.ticks
    const len = ticks.length

    // Draw ticks - make them shorter (3px instead of LAYOUT.TICK_LENGTH)
    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      const x = LEFT_LABEL_WIDTH + tick.position * plotAreaWidth + marginLeft
      const y1 = yLine
      const y2 = y1 + 5

      ctx.beginPath()
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
      ctx.stroke()
    }

    // Draw bottom border line
    ctx.beginPath()
    ctx.moveTo(LEFT_LABEL_WIDTH + marginLeft, yLine)
    ctx.lineTo(LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft, yLine)
    ctx.stroke()
  }

  function drawRectangles(ctx: CanvasRenderingContext2D) {
    const segments = rectangleSegments
    if (segments.length === 0) return

    const RECT_STRIDE = 12

    // Local references for faster access
    const rectStyles = rectStyleMap
    const { indexToId } = identifierSystem

    // Use the pre-computed style buckets
    const styleBuckets = rectangleStyleBuckets

    // Draw normal elements
    ctx.globalAlpha = 1.0
    styleBuckets.forEach((segmentIndices, styleIdx) => {
      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = rectStyles.get(identifier) ?? {
        normal: { fill: '#ccc' },
        dimmed: { fill: '#ccc', opacity: 0.15 },
      }

      ctx.fillStyle = styleSet.normal.fill

      for (const i of segmentIndices) {
        const idx = i * RECT_STRIDE
        const isDimmed = segments[idx + 8] === 1

        if (!isDimmed) {
          ctx.fillRect(
            segments[idx],
            segments[idx + 1],
            segments[idx + 2],
            segments[idx + 3]
          )
        }
      }
    })

    // Draw dimmed elements
    ctx.globalAlpha = 0.15
    styleBuckets.forEach((segmentIndices, styleIdx) => {
      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = rectStyles.get(identifier) ?? {
        normal: { fill: '#ccc' },
      }

      ctx.fillStyle = styleSet.normal.fill

      for (const i of segmentIndices) {
        const idx = i * RECT_STRIDE
        const isDimmed = segments[idx + 8] === 1

        if (isDimmed) {
          ctx.fillRect(
            segments[idx],
            segments[idx + 1],
            segments[idx + 2],
            segments[idx + 3]
          )
        }
      }
    })

    // Reset alpha
    ctx.globalAlpha = 1
  }

  function drawLines(ctx: CanvasRenderingContext2D) {
    const segments = lineSegments
    if (segments.length === 0) return

    const LINE_STRIDE = 10

    // Local references for fast access
    const lineStyles = lineStyleMap
    const { indexToId } = identifierSystem

    // Use the pre-computed style buckets
    const styleBuckets = lineStyleBuckets

    // Draw normal lines
    ctx.globalAlpha = 1.0
    ctx.setLineDash([2, 2])

    styleBuckets.forEach((segmentIndices, styleIdx) => {
      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = lineStyles.get(identifier) ?? {
        normal: { stroke: '#ccc', strokeWidth: 1 },
      }

      ctx.strokeStyle = styleSet.normal.stroke
      ctx.lineWidth = styleSet.normal.strokeWidth ?? 1

      for (const i of segmentIndices) {
        const idx = i * LINE_STRIDE
        const isDimmed = segments[idx + 6] === 1

        if (!isDimmed) {
          ctx.beginPath()
          ctx.moveTo(segments[idx], segments[idx + 1])
          ctx.lineTo(segments[idx + 2], segments[idx + 3])
          ctx.stroke()
        }
      }
    })

    // Draw dimmed lines
    ctx.globalAlpha = 0.15
    ctx.setLineDash([2, 2])

    styleBuckets.forEach((segmentIndices, styleIdx) => {
      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = lineStyles.get(identifier) ?? {
        normal: { stroke: '#ccc', strokeWidth: 1 },
      }

      ctx.strokeStyle = styleSet.normal.stroke
      ctx.lineWidth = styleSet.normal.strokeWidth ?? 1

      for (const i of segmentIndices) {
        const idx = i * LINE_STRIDE
        const isDimmed = segments[idx + 6] === 1

        if (isDimmed) {
          ctx.beginPath()
          ctx.moveTo(segments[idx], segments[idx + 1])
          ctx.lineTo(segments[idx + 2], segments[idx + 3])
          ctx.stroke()
        }
      }
    })

    // Reset rendering state
    ctx.globalAlpha = 1
    ctx.setLineDash([])
  }

  function drawXAxisLabel(ctx: CanvasRenderingContext2D) {

    // watch out that setUpFont function is called before this function is called!

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Position the label using exact coordinates from calculatedHeights
    const labelY = calculatedHeights.axisLabelY + marginTop

    ctx.fillText(
      xAxisLabel,
      LEFT_LABEL_WIDTH + (plotAreaWidth >> 1) + marginLeft,
      labelY
    )
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
    const legendX = LEFT_LABEL_WIDTH + LAYOUT.PADDING + marginLeft
    const legendY = calculatedHeights.legendY + marginTop

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

  function drawLegendGroupTitles(ctx: CanvasRenderingContext2D) {
    // watch out that setUpFont function is called before this function is called!

    // Draw group titles
    if (legendGeometry.groupTitles && legendGeometry.groupTitles.length > 0) {

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      // set semi-bold font
      ctx.font = `600 ${LEGEND.FONT_SIZE}px ${SYSTEM_SANS_SERIF_STACK}`

      const titles = legendGeometry.groupTitles
      const len = titles.length

      for (let i = 0; i < len; i++) {
        const group = titles[i]
        ctx.fillText(group.title, group.x, group.y)
      }
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

    // Draw each legend item
    if (legendGeometry.items && legendGeometry.items.length > 0) {
      const items = legendGeometry.items
      const len = items.length

      for (let i = 0; i < len; i++) {
        const item = items[i]
        const isHighlighted = item.identifier === usedHighlight
        const anyHighlightActive = usedHighlight !== null

        // Set opacity based on highlight state
        if (anyHighlightActive) {
          ctx.globalAlpha = isHighlighted ? 1.0 : 0.15
        } else {
          ctx.globalAlpha = 1.0
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
        } else {
          // Draw line for visibility items
          ctx.strokeStyle = item.color
          ctx.lineWidth = item.height
          ctx.setLineDash([2, 2])

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
      }
    }

    // Reset opacity
    ctx.globalAlpha = 1.0
  }

  function drawLegendItemTexts(ctx: CanvasRenderingContext2D) {

    // Draw each legend item
    if (legendGeometry.items && legendGeometry.items.length > 0) {
      const items = legendGeometry.items
      const len = items.length

      for (let i = 0; i < len; i++) {
        const item = items[i]
        const isHighlighted = item.identifier === usedHighlight
        const anyHighlightActive = usedHighlight !== null

        // Set opacity based on highlight state
        if (anyHighlightActive) {
          ctx.globalAlpha = isHighlighted ? 1.0 : 0.15
        } else {
          ctx.globalAlpha = 1.0
        }

        // Draw item text
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'

        // Truncate text if too long using pixel width
        const truncatedName = truncateTextToPixelWidth(
          item.name,
          item.width - LEGEND.ICON_WIDTH - LEGEND.TEXT_PADDING,
          LEGEND.FONT_SIZE
        )
        ctx.fillText(
          truncatedName,
          item.x + LEGEND.ICON_WIDTH + LEGEND.TEXT_PADDING,
          item.y + LEGEND.ITEM_HEIGHT - 4
        )
      }
    }
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
    const legendItem = isMouseOverLegendItem(mouseX, mouseY)

    // Handle legend item tooltips
    if (legendItem !== hoveredLegendItem) {
      if (legendItem) {
        // Show tooltip with "Highlight [FULLNAMEOFAOI]" or "Dehighlight [FULLNAMEOFAOI]" text
        hoveredLegendItem = legendItem
        const isHighlighted = legendItem.identifier === usedHighlight
        const tooltipContent = [
          {
            key: '',
            value: `${isHighlighted ? 'Dehighlight' : 'Highlight'} ${legendItem.name}`,
          },
        ]

        // Get tooltip position using the same utility as segment tooltips
        const tooltipPos = getTooltipPosition(
          canvasState,
          legendItem.x + LEGEND.ICON_WIDTH * 1.5,
          legendItem.y + LEGEND.ITEM_HEIGHT, // Position at bottom of legend item
          { x: 0, y: 7 } // 7px below the legend item
        )

        updateTooltip({
          visible: true,
          content: tooltipContent,
          x: tooltipPos.x,
          y: tooltipPos.y
        })
      } else if (hoveredLegendItem) {
        // Hide tooltip when mouse leaves legend item
        hoveredLegendItem = null
        updateTooltip(null)
      }
    }

    if (hoveredLegendItem) {
      canvas.style.cursor = 'pointer'
      return
    }

    // Check if mouse is in the draggable area
    const inDraggableArea =
      mouseX >= LEFT_LABEL_WIDTH + marginLeft &&
      mouseX <= LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft &&
      mouseY >= marginTop &&
      mouseY <= data.participants.length * data.heightOfBarWrap + marginTop

    // Update cursor based on dragging state and location
    if (isDragging || preparedForDragging) {
      canvas.style.cursor = 'grabbing'
    } else if (inDraggableArea && !isHoveringSegment) {
      canvas.style.cursor = 'grab'
    } else {
      canvas.style.cursor = 'default'
    }

    // Find the segment under the mouse pointer using TypedArray
    const hoveredSegment = findHoveredRectSegment(mouseX, mouseY)

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
        hoveredSegment.y + hoveredSegment.height / 2,
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
    // Hide legend tooltip when mouse leaves canvas
    if (hoveredLegendItem) {
      hoveredLegendItem = null
      updateTooltip(null)
    }

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
    // Reset all drag state
    hasDragStarted = false
    preparedForDragging = false
    dragStartX = 0
    dragStartY = 0
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

    // Only prepare for potential drag in the chart area
    if (
      mouseX >= LEFT_LABEL_WIDTH + marginLeft &&
      mouseX <= LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft &&
      mouseY >= marginTop &&
      mouseY <= data.participants.length * data.heightOfBarWrap + marginTop &&
      !isHoveringSegment
    ) {
      // Store initial position and prepare for dragging
      dragStartX = mouseX
      dragStartY = mouseY
      hasDragStarted = false
      preparedForDragging = true
      // Show grabbing cursor immediately
      if (canvas) {
        canvas.style.cursor = 'grabbing'
      }
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false
      onDragEnd()  // Call drag end handler
      if (canvas) {
        canvas.style.cursor = 'grab'
      }
    }
    // Reset all drag state
    hasDragStarted = false
    preparedForDragging = false
    dragStartX = 0
    dragStartY = 0
  }

  function handleDrag(event: MouseEvent) {
    if (!canvas) return

    // Get mouse position with correct scaling
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

    // If we haven't started dragging yet, check if we should
    if (!hasDragStarted && dragStartX !== 0) {
      const deltaX = Math.abs(mouseX - dragStartX)
      const deltaY = Math.abs(mouseY - dragStartY)
      const threshold = 5 // 5px threshold to distinguish click from drag
      
      if (deltaX > threshold || deltaY > threshold) {
        // Start actual dragging
        hasDragStarted = true
        isDragging = true
        preparedForDragging = false // No longer just prepared, now actively dragging
        if (canvas) {
          canvas.style.cursor = 'grabbing'
        }
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
      preparedForDragging = false
      dragStartX = 0
      dragStartY = 0
      if (canvas) {
        canvas.style.cursor = 'pointer'
      }
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

      // Global event listeners are now handled by <svelte:window> in the template

      return () => {
        cleanup()

        if (hoverTimeout !== null) {
          window.clearTimeout(hoverTimeout)
        }

        // Clean up any remaining tooltips
        if (hoveredLegendItem) {
          updateTooltip(null)
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
      dpiOverride, // Add dpiOverride to the dependency list
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
    ]

    // Schedule a render instead of immediate execution
    untrack(() => {
      // If dpiOverride changed, reinitialize the canvas with the new value
      if (canvas && canvasState.dpiOverride !== dpiOverride) {
        canvasState = setupCanvas(canvasState, canvas, dpiOverride)
      }
      resizeCanvas(canvasState, totalWidth, totalHeight)
      scheduleRender()
    })
  })

  function findHoveredRectSegment(mouseX: number, mouseY: number) {
    const segments = rectangleSegments
    if (segments.length === 0) return null

    const RECT_STRIDE = 12
    const len = segments.length / RECT_STRIDE

    // Fast identifier lookup
    const { indexToId } = identifierSystem

    // Check in reverse order (top to bottom visually) to match z-index behavior
    for (let i = len - 1; i >= 0; i--) {
      const idx = i * RECT_STRIDE

      const x = segments[idx]
      const y = segments[idx + 1]
      const width = segments[idx + 2]
      const height = segments[idx + 3]
      const identifierIdx = segments[idx + 4]
      const participantId = segments[idx + 5]
      const segmentId = segments[idx + 6]
      const orderId = segments[idx + 7]

      if (
        mouseX >= x &&
        mouseX <= x + width &&
        mouseY >= y &&
        mouseY <= y + height
      ) {
        return {
          x,
          y,
          width,
          height,
          identifier: indexToId.get(identifierIdx) ?? '',
          participantId,
          segmentId,
          orderId,
        }
      }
    }

    return null
  }

  // Create derived stores for style buckets that update only when segment data changes
  const rectangleStyleBuckets = $derived.by(() => {
    const segments = rectangleSegments
    if (segments.length === 0) return new Map<number, number[]>()

    const RECT_STRIDE = 12
    const len = segments.length / RECT_STRIDE
    const styleBuckets = new Map<number, number[]>()

    // Single pass to populate buckets by style index - O(n)
    for (let i = 0; i < len; i++) {
      const idx = i * RECT_STRIDE
      const identifierIdx = segments[idx + 4]

      // Get or create bucket for this style
      let bucket = styleBuckets.get(identifierIdx)
      if (!bucket) {
        bucket = []
        styleBuckets.set(identifierIdx, bucket)
      }
      bucket.push(i)
    }

    return styleBuckets
  })

  const lineStyleBuckets = $derived.by(() => {
    const segments = lineSegments
    if (segments.length === 0) return new Map<number, number[]>()

    const LINE_STRIDE = 10
    const len = segments.length / LINE_STRIDE
    const styleBuckets = new Map<number, number[]>()

    // Single pass to populate buckets by style index - O(n)
    for (let i = 0; i < len; i++) {
      const idx = i * LINE_STRIDE
      const identifierIdx = segments[idx + 4]

      // Get or create bucket for this style
      let bucket = styleBuckets.get(identifierIdx)
      if (!bucket) {
        bucket = []
        styleBuckets.set(identifierIdx, bucket)
      }
      bucket.push(i)
    }

    return styleBuckets
  })

  // Clean up tooltip when unmounting
  onDestroy(() => {
    if (hoveredLegendItem) {
      updateTooltip(null)
    }
  })
</script>

<svelte:window 
  on:mousemove={handleDrag} 
  on:mouseup={handleMouseUp} 
/>

<canvas
  class="scarf-plot-figure"
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
