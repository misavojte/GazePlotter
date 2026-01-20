<script lang="ts">
  import type { ScarfFillingType } from '$lib/plots/scarf/types'
  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
    computeGroupedLegendGeometry,
    drawLegend,
    drawLegendGroupTitles,
    hitTestLegend,
    getLegendTooltipPosition,
    getLegendTooltipContent,
    SCARF_LEGEND_CONFIG,
    type LegendGroup,
    type LegendGeometry,
    type LegendItemGeometry,
  } from '$lib/plots/shared'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    estimateTextWidth,
  } from '$lib/shared/utils/textUtils'
  import { getContext, onDestroy, onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
  } from '$lib/shared/utils/exportUtils'
  import {
    SCARF_LAYOUT,
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
    highlights = [],
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


  const LEFT_LABEL_WIDTH = $derived(data.leftLabelWidth)

  // State management with Svelte 5 runes
  let isDragging = $state(false) // New state to track if actively dragging
  let isHoveringSegment = $state(false) // Track if hovering or recently hovering a segment
  let hoverTimeout: number | null = $state(null) // Timeout ID
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  $effect(() => {
    if (!exportRegistrar) return
    if (!canvas) return

    exportRegistrar.register({ kind: 'canvas', getCanvas: () => canvas })

    return () => {
      exportRegistrar.register(null)
    }
  })
  let dragStartX = $state(0) // Track drag start position
  let dragStartY = $state(0) // Track drag start position
  let hasDragStarted = $state(false) // Track if drag threshold has been exceeded
  let preparedForDragging = $state(false) // Track if prepared for dragging (shows draggable cursor)
  let hoveredLegendItem = $state<LegendItemGeometry | null>(null) // Track currently hovered legend item

  // Use highlights directly from props - workspace is the single source of truth
  const usedHighlights = $derived(highlights)
  const xAxisLabel = $derived(getXAxisLabel(settings.timeline))

  // Convert styling data to grouped legend format
  const legendGroups: LegendGroup[] = $derived.by(() => {
    if (!data.stylingAndLegend) return []
    
    const groups: LegendGroup[] = []
    
    // AOI group (Fixations)
    if (data.stylingAndLegend.aoi.length > 0) {
      groups.push({
        title: 'Fixations',
        items: data.stylingAndLegend.aoi.map(item => ({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          height: item.height,
          type: 'rect' as const,
        })),
      })
    }
    
    // Category group (Non-fixations)
    if (data.stylingAndLegend.category.length > 0) {
      groups.push({
        title: 'Non-fixations',
        items: data.stylingAndLegend.category.map(item => ({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          height: item.height,
          type: 'rect' as const,
        })),
      })
    }
    
    // Visibility group (AOI Visibility)
    if (data.stylingAndLegend.visibility.length > 0) {
      groups.push({
        title: 'AOI Visibility',
        items: data.stylingAndLegend.visibility.map(item => ({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          height: item.height,
          type: 'line' as const,
        })),
      })
    }
    
    return groups
  })

  // Compute legend geometry using the utility (memoized by $derived)
  const legendGeometry: LegendGeometry = $derived.by(() => {
    if (!data.stylingAndLegend || legendGroups.length === 0) {
      return { items: [], height: 0, groupTitles: [], totalHeight: 0, itemsPerRow: 3 }
    }
    
    const legendX = marginLeft + LAYOUT.PADDING
    const legendY = calculatedHeights.legendY + marginTop
    
    return computeGroupedLegendGeometry(
      legendGroups,
      SCARF_LEGEND_CONFIG,
      legendX,
      legendY,
      chartWidth
    )
  })

  // SVG size calculations - MOVE THESE BEFORE RECTANGLE/LINE CALCULATIONS
  const totalWidth = $derived(chartWidth + marginLeft + marginRight)

  // Track the currently hovered segment
  let currentHoveredSegment = $state<{
    participantId: string | number
    orderId: number
  } | null>(null)

  // Plot area width is computed in the transform alongside visual buffers
  const plotAreaWidth = $derived(data.plotAreaWidth)

  // Highlight mask by style index (computed once per highlight change)
  const highlightMaskByIndex = $derived.by(() => {
    if (!usedHighlights || usedHighlights.length === 0) return null
    const total = identifierSystem.totalIdentifiers
    if (!total) return null

    const mask = new Uint8Array(total)
    const { idToIndex } = identifierSystem
    for (let i = 0; i < usedHighlights.length; i++) {
      const idx = idToIndex.get(usedHighlights[i])
      if (idx != null) mask[idx] = 1
    }
    return mask
  })

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

  const visualRectBuckets = $derived(data.visualRectBuckets)
  const visualLineBuckets = $derived(data.visualLineBuckets)

  // Interaction handlers
  function handleLegendIdentifier(identifier: string) {
    // Propagate to parent component - workspace is single source of truth
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

    // ---- STOP OF TEXT DRAWING ---- //

    // Draw participant ticks
    drawParticipantTicks(ctx)

    // Draw X-Axis ticks and bottom border
    drawXAxisTicksAndBorder(ctx)

    // Draw top border and ticks
    drawTopBorderAndTicks(ctx)

    // Draw rectangle segments
    drawRectangles(ctx)

    // Draw line segments
    drawLines(ctx)

    // Draw legend using shared utility
    drawLegendGroupTitles(ctx, legendGeometry, SCARF_LEGEND_CONFIG)
    drawLegend(ctx, legendGeometry, SCARF_LEGEND_CONFIG, usedHighlights)

    finishCanvasDrawing(canvasState)
  }

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `${FONT_PRIMARY.SIZE}px ${FONT_PRIMARY.FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = FONT_PRIMARY.COLOR
  }

  function drawParticipantLabels(ctx: CanvasRenderingContext2D) {
    // watch out that setUpFont function is called before this function is called!

    ctx.textAlign = 'end'
    ctx.textBaseline = 'middle'

    const participants = data.participants
    const len = participants.length
    const xPos = LEFT_LABEL_WIDTH + marginLeft - 10

    for (let i = 0; i < len; i++) {
      const participant = participants[i]
      ctx.fillText(
        participant.label,
        xPos,
        i * data.heightOfBarWrap + (data.heightOfBarWrap >> 1) + marginTop
      )
    }
  }

  function drawParticipantTicks(ctx: CanvasRenderingContext2D) {
    // Pixel-align coordinates for sharp rendering
    const leftX = Math.floor(LEFT_LABEL_WIDTH + marginLeft) + 0.5
    const rightX = Math.floor(LEFT_LABEL_WIDTH + marginLeft + plotAreaWidth) + 0.5
    
    // Draw the vertical Y-axis lines connecting the ticks using standard grid color
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH
    
    const yTop = Math.floor(marginTop)
    const yBottom = Math.floor(
      calculatedHeights.heightOfParticipantBars + marginTop
    )
    ctx.beginPath()
    ctx.moveTo(leftX, yTop)
    ctx.lineTo(leftX, yBottom)
    ctx.moveTo(rightX, yTop)
    ctx.lineTo(rightX, yBottom)
    ctx.stroke()

    // Draw horizontal lines between participants using subtle ridgeline style
    ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
    ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH

    const participants = data.participants
    const len = participants.length

    for (let i = 0; i <= len; i++) {
      // Draw ticks exactly at bar boundaries
      const y =
        Math.floor(i * calculatedHeights.participantBarHeight + marginTop) + 0.5

      // Draw full line across between participants
      ctx.beginPath()
      ctx.moveTo(leftX, y)
      ctx.lineTo(rightX, y)
      ctx.stroke()
    }
  }

  function drawTopBorderAndTicks(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH

    // Pixel-align coordinates
    const yTop = Math.floor(marginTop) + 0.5
    const leftX = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
    const rightX = Math.floor(LEFT_LABEL_WIDTH + marginLeft + plotAreaWidth)
    const ticks = data.timeline.ticks
    const len = ticks.length

    // Draw top border line
    ctx.beginPath()
    ctx.moveTo(leftX, yTop)
    ctx.lineTo(rightX, yTop)
    ctx.stroke()

    // Draw outward ticks (facing up)
    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      const x =
        Math.floor(
          LEFT_LABEL_WIDTH + tick.position * plotAreaWidth + marginLeft
        ) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, yTop)
      ctx.lineTo(x, yTop - 5)
      ctx.stroke()
    }
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
    const isLast = len - 1

    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      if (!tick.isNice) continue

      const regularXPos =
        LEFT_LABEL_WIDTH + tick.position * plotAreaWidth + marginLeft

      // Only check for overflow on the second-to-last tick
      // and the last tick if with a label (for relative timeline mode)
      if ((i === isSecondToLast || i === isLast) && tick.label) {
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
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH

    // Use the exact height from calculatedHeights and pixel align
    const yLine =
      Math.floor(calculatedHeights.heightOfParticipantBars + marginTop) + 0.5
    const ticks = data.timeline.ticks
    const len = ticks.length

    // Draw ticks - make them shorter (3px instead of LAYOUT.TICK_LENGTH)
    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      const x =
        Math.floor(
          LEFT_LABEL_WIDTH + tick.position * plotAreaWidth + marginLeft
        ) + 0.5
      const y1 = yLine
      const y2 = y1 + 5

      ctx.beginPath()
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
      ctx.stroke()
    }

    // Draw bottom border line
    const leftX = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
    const rightX = Math.floor(LEFT_LABEL_WIDTH + plotAreaWidth + marginLeft)
    ctx.beginPath()
    ctx.moveTo(leftX, yLine)
    ctx.lineTo(rightX, yLine)
    ctx.stroke()
  }

  function drawRectangles(ctx: CanvasRenderingContext2D) {
    const buckets = visualRectBuckets
    if (buckets.length === 0) return

    const RECT_STRIDE = 8

    const isHighlightActive = usedHighlights.length > 0
    const highlightMask = highlightMaskByIndex

    // Local references for faster access
    const rectStyles = rectStyleMap
    const { indexToId } = identifierSystem

    // Draw normal (non-dimmed) elements using path batching
    ctx.globalAlpha = 1.0

    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      if (isDimmed) continue // Skip dimmed in this pass

      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = rectStyles.get(identifier) ?? {
        normal: { fill: '#ccc' },
      }

      ctx.fillStyle = styleSet.normal.fill
      ctx.beginPath() // Start a massive path

      const segmentCount = buffer.length / RECT_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * RECT_STRIDE
        ctx.rect(
          buffer[idx], // x
          buffer[idx + 1], // y
          buffer[idx + 2], // width
          buffer[idx + 3] // height
        )
      }

      ctx.fill() // Send everything to GPU in ONE go
    }

    // Draw dimmed elements using path batching
    ctx.globalAlpha = 0.15

    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      if (!isDimmed) continue // Skip normal in this pass

      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = rectStyles.get(identifier) ?? {
        normal: { fill: '#ccc' },
      }

      ctx.fillStyle = styleSet.normal.fill
      ctx.beginPath() // Start a massive path

      const segmentCount = buffer.length / RECT_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * RECT_STRIDE
        ctx.rect(
          buffer[idx], // x
          buffer[idx + 1], // y
          buffer[idx + 2], // width
          buffer[idx + 3] // height
        )
      }

      ctx.fill() // Send everything to GPU in ONE go
    }

    // Reset alpha
    ctx.globalAlpha = 1
  }

  function drawLines(ctx: CanvasRenderingContext2D) {
    const buckets = visualLineBuckets
    if (buckets.length === 0) return

    const LINE_STRIDE = 6

    const isHighlightActive = usedHighlights.length > 0
    const highlightMask = highlightMaskByIndex

    // Local references for fast access
    const lineStyles = lineStyleMap
    const { indexToId } = identifierSystem

    // Draw normal lines using path batching
    ctx.globalAlpha = 1.0
    ctx.setLineDash([2, 2])

    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      if (isDimmed) continue // Skip dimmed in this pass

      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = lineStyles.get(identifier) ?? {
        normal: { stroke: '#ccc', strokeWidth: 1 },
      }

      ctx.strokeStyle = styleSet.normal.stroke
      ctx.lineWidth = styleSet.normal.strokeWidth ?? 1
      ctx.beginPath() // Start a massive path

      const segmentCount = buffer.length / LINE_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * LINE_STRIDE
        ctx.moveTo(buffer[idx], buffer[idx + 1]) // x1, y1
        ctx.lineTo(buffer[idx + 2], buffer[idx + 3]) // x2, y2
      }

      ctx.stroke() // Send everything to GPU in ONE go
    }

    // Draw dimmed lines using path batching
    ctx.globalAlpha = 0.15
    ctx.setLineDash([2, 2])

    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      if (!isDimmed) continue // Skip normal in this pass

      const identifier = indexToId.get(styleIdx) ?? ''
      const styleSet = lineStyles.get(identifier) ?? {
        normal: { stroke: '#ccc', strokeWidth: 1 },
      }

      ctx.strokeStyle = styleSet.normal.stroke
      ctx.lineWidth = styleSet.normal.strokeWidth ?? 1
      ctx.beginPath() // Start a massive path

      const segmentCount = buffer.length / LINE_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * LINE_STRIDE
        ctx.moveTo(buffer[idx], buffer[idx + 1]) // x1, y1
        ctx.lineTo(buffer[idx + 2], buffer[idx + 3]) // x2, y2
      }

      ctx.stroke() // Send everything to GPU in ONE go
    }

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







  // Check if a mouse click or hover is on a legend item
  function isMouseOverLegendItem(mouseX: number, mouseY: number): LegendItemGeometry | null {
    if (!data.stylingAndLegend || !legendGeometry.items.length) return null
    return hitTestLegend(legendGeometry, SCARF_LEGEND_CONFIG, mouseX, mouseY)
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
        const isHighlighted = usedHighlights.includes(legendItem.identifier)
        
        // Use utility functions for tooltip
        const tooltipContent = getLegendTooltipContent(legendItem, isHighlighted)
        const tooltipItemPos = getLegendTooltipPosition(legendItem, SCARF_LEGEND_CONFIG)
        const tooltipPos = getTooltipPosition(
          canvasState,
          tooltipItemPos.x,
          tooltipItemPos.y,
          { x: 0, y: 7 }
        )

        updateTooltip({
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
      onDragEnd() // Call drag end handler
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
      // Reference highlights data to update when it changes
      highlights,
      usedHighlights,
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
    const buckets = visualRectBuckets
    if (buckets.length === 0) return null

    const RECT_STRIDE = 8

    // Fast identifier lookup
    const { indexToId } = identifierSystem

    // Check in reverse order (top to bottom visually) to match z-index behavior
    // Iterate through buckets in reverse
    for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const len = buffer.length / RECT_STRIDE

      for (let i = len - 1; i >= 0; i--) {
        const idx = i * RECT_STRIDE

        const x = buffer[idx]
        const y = buffer[idx + 1]
        const width = buffer[idx + 2]
        const height = buffer[idx + 3]
        const participantId = buffer[idx + 4]
        const segmentId = buffer[idx + 5]
        const orderId = buffer[idx + 6]

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
            identifier: indexToId.get(styleIdx) ?? '',
            participantId,
            segmentId,
            orderId,
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

<svelte:window on:mousemove={handleDrag} on:mouseup={handleMouseUp} />

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
