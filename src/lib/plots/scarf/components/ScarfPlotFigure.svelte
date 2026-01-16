<script lang="ts">
  import type { ScarfFillingType } from '$lib/plots/scarf/types'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    truncateTextToPixelWidth,
    SYSTEM_SANS_SERIF_STACK,
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
  import { getAoiVisibility } from '$lib/gaze-data/front-process/stores/dataStore'
  import {
    MAX_AOI_PER_STIMULUS,
    SEGMENT_STRIDE,
    SegmentField,
  } from '$lib/gaze-data/shared/types'

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

  const LEFT_LABEL_WIDTH = $derived(data.leftLabelWidth)

  // State management with Svelte 5 runes
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

  // Reusable scratch space to avoid per-frame allocations
  const drawPresent = new Uint8Array(MAX_AOI_PER_STIMULUS)
  const drawPresentList: number[] = []
  const hoverPresent = new Uint8Array(MAX_AOI_PER_STIMULUS)
  const hoverPresentList: number[] = []

  // Use highlights directly from props - workspace is the single source of truth
  const usedHighlights = $derived(highlights)
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

  // Style lookup arrays for fast indexed access

  const rectFillByIndex = $derived.by(() => {
    const total = identifierSystem.totalIdentifiers
    const fills = new Array<string>(total)

    if (data.stylingAndLegend) {
      let idx = 0
      const aoi = data.stylingAndLegend.aoi
      const category = data.stylingAndLegend.category
      const visibility = data.stylingAndLegend.visibility

      for (let i = 0; i < aoi.length; i++) {
        fills[idx++] = aoi[i].color
      }
      for (let i = 0; i < category.length; i++) {
        fills[idx++] = category[i].color
      }
      for (let i = 0; i < visibility.length; i++) {
        fills[idx++] = visibility[i].color
      }
    }

    return fills
  })

  const lineStrokeByIndex = $derived.by(() => {
    const total = identifierSystem.totalIdentifiers
    const strokes = new Array<string>(total)
    if (!data.stylingAndLegend) return strokes

    const base =
      data.stylingAndLegend.aoi.length + data.stylingAndLegend.category.length
    const visibility = data.stylingAndLegend.visibility

    for (let i = 0; i < visibility.length; i++) {
      strokes[base + i] = visibility[i].color
    }

    return strokes
  })

  const lineWidthByIndex = $derived.by(() => {
    const total = identifierSystem.totalIdentifiers
    const widths = new Float32Array(total)
    if (!data.stylingAndLegend) return widths

    const base =
      data.stylingAndLegend.aoi.length + data.stylingAndLegend.category.length
    const visibility = data.stylingAndLegend.visibility

    for (let i = 0; i < visibility.length; i++) {
      widths[base + i] = visibility[i].height
    }

    return widths
  })

  const segmentBuffer = $derived(data.segmentBuffer)
  const indexTable = $derived(data.indexTable)
  const aoiPool = $derived(data.aoiPool)
  const groupMap = $derived(data.groupMap)
  const maxParticipants = $derived(data.maxParticipants)
  const aoiIds = $derived(data.aoiIds)
  const aoiOrderIndex = $derived(data.aoiOrderIndex)
  const hiddenAoiFlags = $derived(data.hiddenAoiFlags)
  const participantEndTimes = $derived(data.participantEndTimes)

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
        const rightEdgeOfText = regularXPos + (textWidth >> 1)

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

  function getParticipantRange(participantId: number) {
    const rangeIdx = (data.stimulusId * maxParticipants + participantId) * 2
    const startIndex = indexTable[rangeIdx]
    const endIndex = indexTable[rangeIdx + 1]
    return { startIndex, endIndex }
  }

  function lowerBoundByEndTime(
    startIndex: number,
    endIndex: number,
    minValue: number
  ) {
    let lo = startIndex
    let hi = endIndex
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const endTime =
        segmentBuffer[mid * SEGMENT_STRIDE + SegmentField.END_TIME]
      if (endTime <= minValue) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    return lo
  }

  function lowerBoundByStartTime(
    startIndex: number,
    endIndex: number,
    maxValue: number
  ) {
    let lo = startIndex
    let hi = endIndex
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const startTime =
        segmentBuffer[mid * SEGMENT_STRIDE + SegmentField.START_TIME]
      if (startTime < maxValue) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    return lo
  }

  function drawRectangles(ctx: CanvasRenderingContext2D) {
    if (segmentBuffer.length === 0) return

    const isHighlightActive = usedHighlights.length > 0
    const highlightMask = highlightMaskByIndex
    const hasHighlight = isHighlightActive && highlightMask

    const barHeight = data.barHeight
    const nonFixationHeight = data.nonFixationHeight
    const spaceAboveRect = data.spaceAboveRect

    const minValue = data.timeline.minValue
    const maxValue = data.timeline.maxValue
    const visibleRange = maxValue - minValue || 1

    const isRelative = settings.timeline === 'relative'
    const isOrdinal = settings.timeline === 'ordinal'

    const aoiStyleCount = data.stylingAndLegend.aoi.length
    const categoryStyleCount = data.stylingAndLegend.category.length
    const noAoiStyleIdx = aoiStyleCount - 1
    const saccadeStyleIdx = aoiStyleCount
    const otherCategoryStyleIdx = aoiStyleCount + 1

    const groupMapOffset = data.stimulusId * MAX_AOI_PER_STIMULUS

    const drawPass = (dimmed: boolean) => {
      ctx.globalAlpha = dimmed ? 0.15 : 1.0

      const participantCount = data.participants.length
      for (let pIndex = 0; pIndex < participantCount; pIndex++) {
        const participant = data.participants[pIndex]
        const participantId = participant.id
        const sessionDuration = participantEndTimes[pIndex]

        const { startIndex, endIndex } = getParticipantRange(participantId)
        const segmentCount = endIndex - startIndex
        if (segmentCount <= 0) continue

        let drawStart = startIndex
        let drawEnd = endIndex

        if (!isRelative) {
          if (isOrdinal) {
            const localStart = Math.max(0, Math.floor(minValue))
            const localEnd = Math.min(segmentCount, Math.ceil(maxValue))
            drawStart = startIndex + localStart
            drawEnd = startIndex + localEnd
          } else {
            drawStart = lowerBoundByEndTime(startIndex, endIndex, minValue)
            drawEnd = lowerBoundByStartTime(startIndex, endIndex, maxValue)
          }
        }

        const yOffset = pIndex * data.heightOfBarWrap + marginTop
        const baseYRect = yOffset + spaceAboveRect
        const yNonFixation =
          yOffset +
          (spaceAboveRect + (barHeight >> 1) - (nonFixationHeight >> 1))

        for (
          let segmentIndex = drawStart;
          segmentIndex < drawEnd;
          segmentIndex++
        ) {
          const localSegmentId = segmentIndex - startIndex
          const base = segmentIndex * SEGMENT_STRIDE
          const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID] | 0
          const startTime = segmentBuffer[base + SegmentField.START_TIME]
          const endTime = segmentBuffer[base + SegmentField.END_TIME]

          let segStart = isOrdinal ? localSegmentId : startTime
          let segEnd = isOrdinal ? localSegmentId + 1 : endTime

          let x: number
          let width: number

          if (isRelative) {
            if (segEnd <= 0 || segStart >= sessionDuration) continue
            if (segStart < 0) segStart = 0
            if (segEnd > sessionDuration) segEnd = sessionDuration
            const safeDuration = sessionDuration > 0 ? sessionDuration : 1
            x = segStart / safeDuration
            width = (segEnd - segStart) / safeDuration
          } else {
            if (segEnd <= minValue || segStart >= maxValue) continue
            if (segStart < minValue) segStart = minValue
            if (segEnd > maxValue) segEnd = maxValue
            x = (segStart - minValue) / visibleRange
            width = (segEnd - segStart) / visibleRange
          }

          const pxX = LEFT_LABEL_WIDTH + x * plotAreaWidth + marginLeft
          const pxW = width * plotAreaWidth

          if (categoryId !== 0) {
            const styleIdx =
              categoryId === 1 ? saccadeStyleIdx : otherCategoryStyleIdx
            if (hasHighlight) {
              const isHighlighted = highlightMask![styleIdx]
              if (dimmed ? isHighlighted : !isHighlighted) continue
            }

            const fill = rectFillByIndex[styleIdx] ?? '#ccc'
            ctx.fillStyle = fill
            ctx.fillRect(pxX, yNonFixation, pxW, nonFixationHeight)
            continue
          }

          const aoiCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
          const aoiPtr = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

          if (aoiCount <= 0) {
            if (hasHighlight) {
              const isHighlighted = highlightMask![noAoiStyleIdx]
              if (dimmed ? isHighlighted : !isHighlighted) continue
            }
            const fill = rectFillByIndex[noAoiStyleIdx] ?? '#ccc'
            ctx.fillStyle = fill
            ctx.fillRect(pxX, baseYRect, pxW, barHeight)
            continue
          }

          drawPresentList.length = 0
          for (let i = 0; i < aoiCount; i++) {
            const rawId = aoiPool[aoiPtr + i]
            if (rawId < 0 || rawId >= MAX_AOI_PER_STIMULUS) continue
            if (hiddenAoiFlags[rawId]) continue

            const mapped = groupMap[groupMapOffset + rawId]
            const groupId = mapped === 0xffff ? rawId : mapped
            if (groupId < 0 || groupId >= MAX_AOI_PER_STIMULUS) continue

            if (!drawPresent[groupId]) {
              drawPresent[groupId] = 1
              drawPresentList.push(groupId)
            }
          }

          const uniqueAoiCount = drawPresentList.length
          if (uniqueAoiCount === 0) {
            if (hasHighlight) {
              const isHighlighted = highlightMask![noAoiStyleIdx]
              if (dimmed ? isHighlighted : !isHighlighted) continue
            }
            const fill = rectFillByIndex[noAoiStyleIdx] ?? '#ccc'
            ctx.fillStyle = fill
            ctx.fillRect(pxX, baseYRect, pxW, barHeight)
            continue
          }

          const aoiRectHeight = barHeight / uniqueAoiCount
          let yLocal = baseYRect
          let emitted = 0

          for (let aoiIdx = 0; aoiIdx < aoiIds.length; aoiIdx++) {
            const orderedId = aoiIds[aoiIdx]
            if (orderedId < 0 || orderedId >= MAX_AOI_PER_STIMULUS) continue
            if (drawPresent[orderedId]) {
              const styleIdx = aoiIdx
              if (hasHighlight) {
                const isHighlighted = highlightMask![styleIdx] === 1
                if (dimmed ? isHighlighted : !isHighlighted) {
                  yLocal += aoiRectHeight
                  drawPresent[orderedId] = 0
                  emitted++
                  continue
                }
              }
              const fill = rectFillByIndex[styleIdx] ?? '#ccc'
              ctx.fillStyle = fill
              ctx.fillRect(pxX, yLocal, pxW, aoiRectHeight)
              yLocal += aoiRectHeight
              emitted++
              drawPresent[orderedId] = 0
            }
          }

          if (emitted < uniqueAoiCount) {
            for (let i = 0; i < drawPresentList.length; i++) {
              const remainingId = drawPresentList[i]
              if (drawPresent[remainingId]) {
                const orderIdx = aoiOrderIndex[remainingId]
                const styleIdx = orderIdx >= 0 ? orderIdx : noAoiStyleIdx
                if (hasHighlight) {
                  const isHighlighted = highlightMask![styleIdx] === 1
                  if (dimmed ? isHighlighted : !isHighlighted) {
                    yLocal += aoiRectHeight
                    drawPresent[remainingId] = 0
                    continue
                  }
                }
                const fill = rectFillByIndex[styleIdx] ?? '#ccc'
                ctx.fillStyle = fill
                ctx.fillRect(pxX, yLocal, pxW, aoiRectHeight)
                yLocal += aoiRectHeight
                drawPresent[remainingId] = 0
              }
            }
          }
        }
      }
    }

    if (hasHighlight) {
      drawPass(false)
      drawPass(true)
    } else {
      drawPass(false)
    }

    ctx.globalAlpha = 1
  }

  function drawLines(ctx: CanvasRenderingContext2D) {
    if (!data.stylingAndLegend) return
    if (data.stylingAndLegend.visibility.length === 0) return

    const isHighlightActive = usedHighlights.length > 0
    const highlightMask = highlightMaskByIndex
    const hasHighlight = isHighlightActive && highlightMask

    const minValue = data.timeline.minValue
    const maxValue = data.timeline.maxValue
    const visibleRange = maxValue - minValue || 1
    const isRelative = settings.timeline === 'relative'

    const barHeight = data.barHeight
    const spaceAboveRect = data.spaceAboveRect
    const lineWrappedHeight = data.nonFixationHeight + data.spaceAboveLine
    const rectWrappedHeight = barHeight + (spaceAboveRect << 1)

    const aoiStyleCount = data.stylingAndLegend.aoi.length
    const categoryStyleCount = data.stylingAndLegend.category.length
    const visibilityBase = aoiStyleCount + categoryStyleCount

    const drawPass = (dimmed: boolean) => {
      ctx.globalAlpha = dimmed ? 0.15 : 1.0
      ctx.setLineDash([2, 2])

      for (let aoiIdx = 0; aoiIdx < aoiIds.length; aoiIdx++) {
        const styleIdx = visibilityBase + aoiIdx
        if (hasHighlight) {
          const isHighlighted = highlightMask![styleIdx]
          if (dimmed ? isHighlighted : !isHighlighted) continue
        }

        const stroke = lineStrokeByIndex[styleIdx] ?? '#ccc'
        const width = lineWidthByIndex[styleIdx] || 1
        ctx.strokeStyle = stroke
        ctx.lineWidth = width

        ctx.beginPath()

        const aoiId = aoiIds[aoiIdx]
        for (let pIndex = 0; pIndex < data.participants.length; pIndex++) {
          const participantId = data.participants[pIndex].id
          const sessionDuration = participantEndTimes[pIndex]

          const visibility = getAoiVisibility(
            data.stimulusId,
            aoiId,
            participantId
          )
          if (visibility == null) continue

          const y =
            pIndex * data.heightOfBarWrap +
            rectWrappedHeight +
            aoiIdx * lineWrappedHeight +
            marginTop

          for (let i = 0; i < visibility.length; i += 2) {
            let start = visibility[i]
            let end = visibility[i + 1]

            if (end <= 0 || start >= sessionDuration) continue
            if (start < 0) start = 0
            if (end > sessionDuration) end = sessionDuration

            if (!isRelative) {
              if (end <= minValue || start >= maxValue) continue
              if (start < minValue) start = minValue
              if (end > maxValue) end = maxValue
            }

            let x1: number
            let x2: number

            if (isRelative) {
              const safeDuration = sessionDuration > 0 ? sessionDuration : 1
              x1 = start / safeDuration
              x2 = end / safeDuration
            } else {
              x1 = (start - minValue) / visibleRange
              x2 = (end - minValue) / visibleRange
            }

            const pxX1 = LEFT_LABEL_WIDTH + x1 * plotAreaWidth + marginLeft
            const pxX2 = LEFT_LABEL_WIDTH + x2 * plotAreaWidth + marginLeft
            ctx.moveTo(pxX1, y)
            ctx.lineTo(pxX2, y)
          }
        }

        ctx.stroke()
      }
    }

    if (hasHighlight) {
      drawPass(false)
      drawPass(true)
    } else {
      drawPass(false)
    }

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
        const isHighlighted = usedHighlights.includes(item.identifier)
        const anyHighlightActive = usedHighlights.length > 0

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
        const isHighlighted = usedHighlights.includes(item.identifier)
        const anyHighlightActive = usedHighlights.length > 0

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
        const isHighlighted = usedHighlights.includes(legendItem.identifier)
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
    if (segmentBuffer.length === 0) return null

    const localY = mouseY - marginTop
    if (localY < 0) return null

    const participantIndex = Math.floor(localY / data.heightOfBarWrap)
    if (participantIndex < 0 || participantIndex >= data.participants.length) {
      return null
    }

    const participant = data.participants[participantIndex]
    const participantId = participant.id
    const sessionDuration = participantEndTimes[participantIndex]

    const plotLeft = LEFT_LABEL_WIDTH + marginLeft
    const plotRight = plotLeft + plotAreaWidth
    if (mouseX < plotLeft || mouseX > plotRight) return null

    const minValue = data.timeline.minValue
    const maxValue = data.timeline.maxValue
    const visibleRange = maxValue - minValue || 1

    const isRelative = settings.timeline === 'relative'
    const isOrdinal = settings.timeline === 'ordinal'

    const xNorm = (mouseX - plotLeft) / plotAreaWidth
    const t = isRelative
      ? xNorm * sessionDuration
      : minValue + xNorm * visibleRange

    const { startIndex, endIndex } = getParticipantRange(participantId)
    const segmentCount = endIndex - startIndex
    if (segmentCount <= 0) return null

    let segmentIndex = -1
    let localSegmentId = -1

    if (isOrdinal) {
      localSegmentId = Math.floor(t)
      if (localSegmentId < 0 || localSegmentId >= segmentCount) return null
      segmentIndex = startIndex + localSegmentId
    } else {
      let lo = startIndex
      let hi = endIndex
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        const startTime =
          segmentBuffer[mid * SEGMENT_STRIDE + SegmentField.START_TIME]
        if (startTime <= t) {
          lo = mid + 1
        } else {
          hi = mid
        }
      }
      const idx = lo - 1
      if (idx < startIndex) return null
      const endTime =
        segmentBuffer[idx * SEGMENT_STRIDE + SegmentField.END_TIME]
      if (t >= endTime) return null
      segmentIndex = idx
      localSegmentId = idx - startIndex
    }

    const base = segmentIndex * SEGMENT_STRIDE
    const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID] | 0
    const startTime = segmentBuffer[base + SegmentField.START_TIME]
    const endTime = segmentBuffer[base + SegmentField.END_TIME]
    const segmentId = segmentBuffer[base + SegmentField.SEGMENT_ID] | 0

    let segStart = isOrdinal ? localSegmentId : startTime
    let segEnd = isOrdinal ? localSegmentId + 1 : endTime

    let x: number
    let width: number

    if (isRelative) {
      const safeDuration = sessionDuration > 0 ? sessionDuration : 1
      if (segEnd <= 0 || segStart >= sessionDuration) return null
      if (segStart < 0) segStart = 0
      if (segEnd > sessionDuration) segEnd = sessionDuration
      x = segStart / safeDuration
      width = (segEnd - segStart) / safeDuration
    } else {
      if (segEnd <= minValue || segStart >= maxValue) return null
      if (segStart < minValue) segStart = minValue
      if (segEnd > maxValue) segEnd = maxValue
      x = (segStart - minValue) / visibleRange
      width = (segEnd - segStart) / visibleRange
    }

    const pxX = plotLeft + x * plotAreaWidth
    const pxW = width * plotAreaWidth

    const barHeight = data.barHeight
    const nonFixationHeight = data.nonFixationHeight
    const spaceAboveRect = data.spaceAboveRect
    const yOffset = participantIndex * data.heightOfBarWrap + marginTop
    const baseYRect = yOffset + spaceAboveRect
    const yNonFixation =
      yOffset + (spaceAboveRect + (barHeight >> 1) - (nonFixationHeight >> 1))

    if (categoryId !== 0) {
      if (
        mouseY >= yNonFixation &&
        mouseY <= yNonFixation + nonFixationHeight
      ) {
        return {
          x: pxX,
          y: yNonFixation,
          width: pxW,
          height: nonFixationHeight,
          identifier: '',
          participantId,
          segmentId,
          orderId: localSegmentId,
        }
      }
      return null
    }

    const aoiCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

    if (aoiCount <= 0) {
      if (mouseY >= baseYRect && mouseY <= baseYRect + barHeight) {
        return {
          x: pxX,
          y: baseYRect,
          width: pxW,
          height: barHeight,
          identifier: '',
          participantId,
          segmentId,
          orderId: localSegmentId,
        }
      }
      return null
    }

    hoverPresentList.length = 0
    const groupMapOffset = data.stimulusId * MAX_AOI_PER_STIMULUS
    for (let i = 0; i < aoiCount; i++) {
      const rawId = aoiPool[aoiPtr + i]
      if (rawId < 0 || rawId >= MAX_AOI_PER_STIMULUS) continue
      if (hiddenAoiFlags[rawId]) continue
      const mapped = groupMap[groupMapOffset + rawId]
      const groupId = mapped === 0xffff ? rawId : mapped
      if (groupId < 0 || groupId >= MAX_AOI_PER_STIMULUS) continue
      if (!hoverPresent[groupId]) {
        hoverPresent[groupId] = 1
        hoverPresentList.push(groupId)
      }
    }

    const uniqueAoiCount = hoverPresentList.length
    if (uniqueAoiCount === 0) {
      if (mouseY >= baseYRect && mouseY <= baseYRect + barHeight) {
        return {
          x: pxX,
          y: baseYRect,
          width: pxW,
          height: barHeight,
          identifier: '',
          participantId,
          segmentId,
          orderId: localSegmentId,
        }
      }
      return null
    }

    const aoiRectHeight = barHeight / uniqueAoiCount
    let yLocal = baseYRect

    for (let aoiIdx = 0; aoiIdx < aoiIds.length; aoiIdx++) {
      const orderedId = aoiIds[aoiIdx]
      if (orderedId < 0 || orderedId >= MAX_AOI_PER_STIMULUS) continue
      if (hoverPresent[orderedId]) {
        if (mouseY >= yLocal && mouseY <= yLocal + aoiRectHeight) {
          hoverPresent[orderedId] = 0
          return {
            x: pxX,
            y: yLocal,
            width: pxW,
            height: aoiRectHeight,
            identifier: '',
            participantId,
            segmentId,
            orderId: localSegmentId,
          }
        }
        yLocal += aoiRectHeight
        hoverPresent[orderedId] = 0
      }
    }

    for (let i = 0; i < hoverPresentList.length; i++) {
      const remainingId = hoverPresentList[i]
      if (hoverPresent[remainingId]) {
        if (mouseY >= yLocal && mouseY <= yLocal + aoiRectHeight) {
          hoverPresent[remainingId] = 0
          return {
            x: pxX,
            y: yLocal,
            width: pxW,
            height: aoiRectHeight,
            identifier: '',
            participantId,
            segmentId,
            orderId: localSegmentId,
          }
        }
        yLocal += aoiRectHeight
        hoverPresent[remainingId] = 0
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
