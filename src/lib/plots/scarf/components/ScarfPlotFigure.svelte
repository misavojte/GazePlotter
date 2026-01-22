<script lang="ts">
  import type { ScarfData } from '$lib/plots/scarf/types'
  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
    computeGroupedLegendGeometry,
    drawLegend,
    drawLegendGroupTitles,
    SCARF_LEGEND_CONFIG,
    drawTimelineLabels,
    drawXAxisTicksAndBorder,
    drawTopXAxisTicksAndBorder,
    drawXAxisLabel,
    hitTestLegend,
    getLegendTooltipPosition,
    getLegendTooltipContent,
    type LegendGroup,
    type LegendGeometry,
    type LegendItemGeometry,
  } from '$lib/plots/shared'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import { calculateTextMetrics } from '$lib/shared/utils/textUtils'
  import { getContext, onDestroy, onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
  } from '$lib/shared/utils/exportUtils'
  import {
    SCARF_LAYOUT,
    getXAxisLabel,
    getScarfIdentifierSystem,
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
    alignToPixelCenter,
    type CanvasState,
  } from '$lib/shared/utils/canvasUtils'
  import { updateTooltip } from '$lib/tooltip'

  interface Props {
    tooltipAreaElement: HTMLElement | SVGElement | null
    data: ScarfData
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

  // Extract participant labels only when needed (normal mode)
  // Stops mapping thousands of names in compact mode
  const participantLabels = $derived.by(() => {
    if (isCompactMode) return []
    return data.participants.map(p => p.label)
  })

  // Preliminary compact mode check to determine label width strategy
  // This must come before LEFT_LABEL_WIDTH to avoid circular dependency
  const isCompactMode = $derived.by(() => {
    const participantCount = data.participants.length
    if (participantCount === 0) return false

    const defaultBH = SCARF_LAYOUT.HEIGHT_OF_BAR
    const defaultWrap = data.heightOfBarWrap
    const fixedOverhead =
      marginTop +
      INTERNAL_PADDING_TOP +
      45 +
      legendHeight +
      marginBottom +
      INTERNAL_PADDING_BOTTOM
    const remainingHeight = availableHeight - fixedOverhead
    const targetWrap = Math.floor(remainingHeight / participantCount)
    const rawScale = targetWrap / defaultWrap
    const prelimScale = Math.max(
      SCARF_LAYOUT.MIN_BAR_HEIGHT / defaultBH,
      Math.min(SCARF_LAYOUT.MAX_BAR_SCALE, rawScale)
    )
    return defaultBH * prelimScale < SCARF_LAYOUT.COMPACT_MODE_THRESHOLD
  })

  // Calculate left label width: fixed in compact mode, dynamic in normal mode
  const LEFT_LABEL_WIDTH = $derived.by(() => {
    if (isCompactMode) {
      return 55 // Increased from 50 to prevent rotated label cropping
    }
    // Dynamic width based on participant labels (normal mode)
    const labels = participantLabels
    if (labels.length === 0) return 0
    const metrics = calculateTextMetrics(labels, SCARF_LAYOUT.LABEL_FONT_SIZE)
    return Math.min(
      SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH,
      Math.max(40, metrics.maxWidth + 15)
    )
  })

  // Plot area width - calculated to fill available space with reserved right margin
  // RIGHT_MARGIN accounts for: event markers at timeline end + gridline stroke alignment
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

  // Internal layout constants for compact rendering
  const INTERNAL_PADDING_TOP = 3 // Space for top ticks
  const INTERNAL_PADDING_BOTTOM = 0 // Zero padding at bottom as it serves no purpose (only top needs space for ticks)

  // 1. Calculate Legend structural metrics (data-only, no layout dependency)
  // This breaks the circular dependency: legend structural height depends only on data.
  const legendHeight = $derived.by(() => {
    const groups = data.legendData?.groups ?? []
    if (groups.length === 0) return 0

    const dummyGroups = groups.map(g => ({
      title: g.title,
      items: g.items.map(i => ({
        identifier: i.identifier,
        name: i.name,
        color: i.color,
        type: 'rect' as const, // Structural type doesn't matter for height
      })),
    }))

    const tempLayout = computeGroupedLegendGeometry(
      dummyGroups,
      SCARF_LEGEND_CONFIG,
      0,
      0,
      chartWidth
    )
    return tempLayout.totalHeight
  })

  // 2. Dynamic Layout Logic - handles both shrinking AND scaling up
  // Unified scale approach: single scaleFactor applied to bar dimensions
  // Compact mode: when bars get too small, remove labels/gaps for density
  // Iterative scaling: recalculate scale in compact mode to fill freed space
  const layout = $derived.by(() => {
    const participantCount = data.participants.length

    // Default dimensions from source data
    const defaultBH = SCARF_LAYOUT.HEIGHT_OF_BAR // 15
    const defaultSAR = SCARF_LAYOUT.SPACE_ABOVE_RECT // 5
    const defaultNFH = SCARF_LAYOUT.NON_FIXATION_HEIGHT // 4
    const defaultWrap = data.heightOfBarWrap

    if (participantCount === 0) {
      return {
        heightOfBar: defaultBH,
        spaceAboveRect: defaultSAR,
        nonFixationHeight: defaultNFH,
        heightOfBarWrap: defaultWrap,
        scaleFactor: 1,
        isCompact: false,
      }
    }

    // Calculate fixed overhead (legend, axis, margins)
    const fixedOverheadAbove = marginTop + INTERNAL_PADDING_TOP
    const fixedOverheadBelow =
      45 + legendHeight + marginBottom + INTERNAL_PADDING_BOTTOM
    const totalFixedOverhead = fixedOverheadAbove + fixedOverheadBelow

    // Available height for all participant rows
    const remainingHeight = availableHeight - totalFixedOverhead
    const targetHeightOfBarWrap = Math.floor(remainingHeight / participantCount)

    // STEP 1: Initial scale assuming normal mode (with vertical gaps)
    const rawScale = targetHeightOfBarWrap / defaultWrap
    let scale = Math.max(
      SCARF_LAYOUT.MIN_BAR_HEIGHT / defaultBH,
      Math.min(SCARF_LAYOUT.MAX_BAR_SCALE, rawScale)
    )

    let scaledBH = defaultBH * scale
    let isCompact = scaledBH < SCARF_LAYOUT.COMPACT_MODE_THRESHOLD

    // STEP 2: If compact, recalculate WITHOUT vertical gaps to utilize freed space
    if (isCompact) {
      // In compact mode: wrap = heightOfBar only (no padding)
      const compactScale = Math.max(
        SCARF_LAYOUT.MIN_BAR_HEIGHT / defaultBH,
        Math.min(SCARF_LAYOUT.MAX_BAR_SCALE, targetHeightOfBarWrap / defaultBH)
      )
      scale = compactScale
      scaledBH = defaultBH * scale
      // DO NOT re-check isCompact here. We stay in compact mode if Step 1 triggered it
      // to avoid hysteresis/oscillation (scale-up pushing it back above threshold).
    }

    // In compact mode: no vertical gaps, bars touch each other
    const scaledSAR = isCompact ? 0 : defaultSAR * scale
    // Cap non-fixation height: max 6px (1.5x default), min 1px
    const scaledNFH = Math.min(6, Math.max(1, defaultNFH * scale))
    // In compact mode: wrap = bar height only (no padding)
    const scaledWrap = isCompact ? scaledBH : defaultWrap * scale

    return {
      heightOfBar: scaledBH,
      spaceAboveRect: scaledSAR,
      nonFixationHeight: scaledNFH,
      heightOfBarWrap: scaledWrap,
      scaleFactor: scale,
      isCompact,
    }
  })

  // 3. Derived dimensions using dynamic layout
  const participantBarsHeight = $derived(
    data.participants.length * layout.heightOfBarWrap
  )
  const axisLabelY = $derived(participantBarsHeight + 30)
  const legendY = $derived(participantBarsHeight + 45)

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

  // Convert ScarfLegendItem (data-only) to LegendItem (with presentation details)
  // Heights are determined here in the presentation layer using layout constants
  const legendGroups: LegendGroup[] = $derived.by(() => {
    const groups = data.legendData?.groups ?? []
    if (groups.length === 0) return []

    // Map styleType to type and height using layout constants
    const getItemPresentation = (styleType: string) => {
      switch (styleType) {
        case 'fixation':
          return { type: 'rect' as const, height: layout.heightOfBar }
        case 'nonFixation':
          return {
            type: 'rect' as const,
            height: layout.nonFixationHeight,
          }
        case 'visibility':
          return {
            type: 'line' as const,
            height: 2,
          }
        default:
          return { type: 'rect' as const, height: layout.heightOfBar }
      }
    }

    return groups.map(group => ({
      title: group.title,
      items: group.items.map(item => {
        const presentation = getItemPresentation(item.styleType)
        return {
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          type: presentation.type,
          height: presentation.height,
        }
      }),
    }))
  })

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

  // Required height for all content (excluding explicit margins)
  // This is the intrinsic height of the visualization content
  // USES legendHeight (static) instead of legendGeometry.totalHeight (which depends on margins)
  const intrinsicContentHeight = $derived.by(() => {
    if (legendHeight > 0) {
      return legendY + legendHeight + INTERNAL_PADDING_BOTTOM
    }
    // If no legend, height is determined by the x-axis label
    // axisLabelY + approximate label height (20px) + padding
    return axisLabelY + 20 + INTERNAL_PADDING_BOTTOM
  })

  // Vertical centering offset: if available space exceeds content, center vertically
  // Subtracting INTERNAL_PADDING_TOP ensures the centering feels balanced with the top safe area
  const centeringOffsetY = $derived(
    availableHeight >
      intrinsicContentHeight + marginTop + marginBottom + INTERNAL_PADDING_TOP
      ? Math.floor(
          (availableHeight -
            intrinsicContentHeight -
            marginTop -
            marginBottom -
            INTERNAL_PADDING_TOP) /
            2
        )
      : 0
  )

  // Effective margins include centering offsets and the internal top safety padding
  // When no margins are set (default 0), this ensures content is centered but safe from cropping
  const effectiveMarginTop = $derived(
    marginTop + centeringOffsetY + INTERNAL_PADDING_TOP
  )

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
    if (isCompactMode) {
      // Compact mode minimum: MAX(participants * MIN_BAR_HEIGHT, MIN_PLOT_HEIGHT_COMPACT) + fixed overhead
      const minPlotHeight = Math.max(
        data.participants.length * SCARF_LAYOUT.MIN_BAR_HEIGHT,
        SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT
      )
      const minCompactHeight =
        minPlotHeight +
        marginTop +
        marginBottom +
        INTERNAL_PADDING_TOP +
        INTERNAL_PADDING_BOTTOM +
        45 +
        legendHeight
      return availableHeight >= minCompactHeight
    }
    // Normal mode: use full content height
    return availableHeight >= totalContentHeight
  })

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

  // These MUST be declared before any derived values that use them
  const visualRectBuckets = $derived(data.visualRectBuckets)
  const visualEventBuckets = $derived(data.visualEventBuckets)

  // Optimize lookups: Convert Map to dense Array for O(1) access during render
  const rectStyleArray = $derived.by(() => {
    const buckets = visualRectBuckets
    const styles = new Array(buckets.length)
    const { indexToId } = identifierSystem
    const map = rectStyleMap

    // Default fallback style
    const fallback = { normal: { fill: '#ccc' } }

    for (let i = 0; i < buckets.length; i++) {
      const id = indexToId.get(i)
      // If no ID or style, use fallback
      if (id !== undefined) {
        styles[i] = map.get(id) ?? fallback
      } else {
        styles[i] = fallback
      }
    }
    return styles
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

  // Optimize lookups: Convert Map to dense Array for O(1) access during render
  const eventStyleArray = $derived.by(() => {
    const buckets = visualEventBuckets
    const styles = new Array(buckets.length)
    const { indexToId } = identifierSystem
    const map = eventStyleMap

    // Default fallback style
    const fallback = { normal: { stroke: '#ccc', strokeWidth: 1 } }

    for (let i = 0; i < buckets.length; i++) {
      const id = indexToId.get(i)
      if (id !== undefined) {
        styles[i] = map.get(id) ?? fallback
      } else {
        styles[i] = fallback
      }
    }
    return styles
  })

  // Calculate layout overrides for overlapping events
  // IMPORTANT: This computation is expensive. We minimize reactive dependencies
  // by using source data values directly and computing in normalized space.
  const eventLayoutOverrides = $derived.by(() => {
    // In compact mode, we skip expensive offset calculation as markers stay centered
    if (isCompactMode) return new Map<number, number>()

    const buckets = visualEventBuckets
    if (buckets.length === 0) return new Map<number, number>()

    const EVENT_STRIDE = 5
    // Use source data dimensions to avoid layout reactivity churn
    const barHeight = data.barHeight
    const barWrapHeight = data.heightOfBarWrap

    // Size logic matches drawEvents: smaller of 20px or 80% of bar height, min 7px
    const size = Math.max(7, Math.min(20, barHeight * 0.8))
    // Overlap threshold in NORMALIZED space (we'll convert to normalized distance)
    // Assume typical plot width of ~1000px for threshold calculation
    const normalizedThreshold = (size * 0.25) / 1000

    // PACKING CONSTANT for Map keys
    const KEY_MULTIPLIER = 1000000

    // 1. Count total events to allocate TypedArrays
    let totalEvents = 0
    for (let i = 0; i < buckets.length; i++) {
      totalEvents += buckets[i].length / EVENT_STRIDE
    }

    if (totalEvents === 0) return new Map<number, number>()

    // 2. Allocate data structures
    const indices = new Int32Array(totalEvents)
    const xPos = new Float32Array(totalEvents)
    const pIds = new Int16Array(totalEvents)
    const styleIds = new Int16Array(totalEvents)
    const eventIndices = new Int32Array(totalEvents)

    // 3. Fill arrays
    let ptr = 0
    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      const count = buffer.length / EVENT_STRIDE

      for (let i = 0; i < count; i++) {
        const idx = i * EVENT_STRIDE
        const xNormalized = buffer[idx]
        const pIndex = buffer[idx + 1]

        indices[ptr] = ptr
        // Store normalized X position (not pixels) to avoid plotAreaWidth dependency
        xPos[ptr] = xNormalized
        pIds[ptr] = pIndex
        styleIds[ptr] = styleIdx
        // Using i (index within bucket) directly
        eventIndices[ptr] = i
        ptr++
      }
    }

    // 4. Sort indices: primarily by Participant (pId), secondarily by X Position
    // We use the indices array to avoid moving large data around
    indices.sort((a, b) => {
      // First sort by participant
      const pDiff = pIds[a] - pIds[b]
      if (pDiff !== 0) return pDiff

      // Then by X position
      return xPos[a] - xPos[b]
    })

    const overrides = new Map<number, number>()

    // 5. Cluster detection and resolution
    // Iterate through the sorted indices
    let clusterStart = 0

    // Limits - use barWrapHeight from source data, not reactive layout
    const availableH = barWrapHeight
    const radius = size / 2
    const margin = radius + 2
    const minY = margin
    const maxY = availableH - margin
    const rangeY = maxY - minY

    // Temp array for sorting cluster items by style (z-index logic)
    // Reused to avoid allocation
    const clusterIndices = []

    for (let i = 0; i < totalEvents; i++) {
      const currIdx = indices[i]
      const nextIdx = i < totalEvents - 1 ? indices[i + 1] : -1

      // Check if we should break the cluster
      let breakCluster = false

      if (nextIdx === -1) {
        breakCluster = true
      } else {
        // Break if different participant
        if (pIds[currIdx] !== pIds[nextIdx]) {
          breakCluster = true
        } else {
          // Break if gap is large enough
          // xPos is normalized, compare with normalized threshold
          const gap = xPos[nextIdx] - xPos[currIdx]
          if (gap >= normalizedThreshold) {
            breakCluster = true
          }
        }
      }

      if (breakCluster) {
        const clusterLen = i - clusterStart + 1

        if (clusterLen > 1) {
          // We have a collision cluster. Resolve it.

          // Collect indices for this cluster
          clusterIndices.length = 0
          for (let k = clusterStart; k <= i; k++) {
            clusterIndices.push(indices[k])
          }

          // Sort by styleIdx to ensure correct stacking order
          // "the one which is first in the AOI order index must be on top"
          // Lower styleIdx = earlier in AOI order
          clusterIndices.sort((a, b) => styleIds[a] - styleIds[b])

          if (minY < maxY) {
            const step = rangeY / Math.max(1, clusterLen - 1)

            for (let k = 0; k < clusterLen; k++) {
              const originalIdx = clusterIndices[k]
              const key =
                styleIds[originalIdx] * KEY_MULTIPLIER +
                eventIndices[originalIdx]
              const internalY = minY + step * k
              overrides.set(key, internalY)
            }
          } else {
            // Fallback centering
            const center = availableH / 2
            for (let k = 0; k < clusterLen; k++) {
              const originalIdx = clusterIndices[k]
              const key =
                styleIds[originalIdx] * KEY_MULTIPLIER +
                eventIndices[originalIdx]
              overrides.set(key, center)
            }
          }
        }

        clusterStart = i + 1
      }
    }

    return overrides
  })

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

    // Check if we can render with current dimensions
    if (!canRender) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#666666'
      ctx.font = '14px sans-serif'
      ctx.fillText(
        'Increase height to view plot',
        totalWidth / 2,
        totalHeight / 2
      )
      finishCanvasDrawing(canvasState)
      return
    }

    // Set up font
    setUpFont(ctx)

    // Draw participant labels (Left Side)
    // Floor dimensions to ensure pixel-perfect synchronization between all drawing layers
    const scarfPlotLeft = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
    const scarfPlotWidth = Math.floor(plotAreaWidth)
    const scarfPlotRight = scarfPlotLeft + scarfPlotWidth

    drawParticipantLabels(ctx, scarfPlotLeft)

    // Draw timeline axis labels and ticks (moved below together)

    // ---- STOP OF TEXT DRAWING ---- //

    // Draw participant ticks
    drawParticipantTicks(ctx)

    // Draw X-Axis ticks and bottom border (moved below together)

    // Draw top border and ticks
    drawTopXAxisTicksAndBorder(
      ctx,
      data.timeline,
      scarfPlotLeft,
      scarfPlotWidth,
      effectiveMarginTop
    )

    // Draw rectangle segments
    drawRectangles(ctx, scarfPlotLeft, scarfPlotWidth)

    // Draw event markers (AOI visibility start/end)
    drawEvents(ctx, scarfPlotLeft, scarfPlotWidth)

    // Draw all text elements (axis labels, ticks)

    drawTimelineLabels(
      ctx,
      data.timeline,
      scarfPlotLeft,
      scarfPlotWidth,
      participantBarsHeight + effectiveMarginTop
    )

    drawXAxisLabel(
      ctx,
      xAxisLabel,
      scarfPlotLeft,
      scarfPlotWidth,
      participantBarsHeight + effectiveMarginTop,
      30
    )

    drawXAxisTicksAndBorder(
      ctx,
      data.timeline,
      scarfPlotLeft,
      scarfPlotWidth,
      participantBarsHeight + effectiveMarginTop
    )

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

  function drawParticipantLabels(ctx: CanvasRenderingContext2D, leftX: number) {
    // watch out that setUpFont function is called before this function is called!

    const participants = data.participants
    const len = participants.length

    if (layout.isCompact) {
      // COMPACT MODE: rotated two-line axis label + index ticks
      // Draw rotated "Participants" + "[order indices]" label (two lines, centered)
      ctx.save()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const labelX = leftX - 40
      const labelY = effectiveMarginTop + participantBarsHeight / 2
      ctx.translate(labelX, labelY)
      ctx.rotate(-Math.PI / 2)
      const lineHeight = FONT_PRIMARY.SIZE * 1.2
      ctx.fillText('Participants', 0, -lineHeight / 2)
      ctx.fillText('[order indices]', 0, lineHeight / 2)
      ctx.restore()

      // Draw nice index ticks on the left axis (0-indexed, min step 5)
      ctx.textAlign = 'end'
      ctx.textBaseline = 'middle'
      const tickX = LEFT_LABEL_WIDTH + marginLeft - 8

      // Calculate nice tick step (minimum 5, aim for ~5-10 ticks)
      const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
      let step = 5
      for (const s of niceSteps) {
        if (len / s <= 10) {
          step = s
          break
        }
      }

      // Draw index ticks at nice intervals (0-indexed)
      for (let i = 0; i < len; i += step) {
        const y =
          i * layout.heightOfBarWrap +
          layout.heightOfBarWrap / 2 +
          effectiveMarginTop
        ctx.fillText(String(i), tickX, y)
      }
      // Always draw the last index if not already drawn
      const lastIdx = len - 1
      if (lastIdx % step !== 0) {
        const y =
          lastIdx * layout.heightOfBarWrap +
          layout.heightOfBarWrap / 2 +
          effectiveMarginTop
        ctx.fillText(String(lastIdx), tickX, y)
      }
    } else {
      // NORMAL MODE: individual participant labels
      ctx.textAlign = 'end'
      ctx.textBaseline = 'middle'
      const xPos = leftX - 10

      for (let i = 0; i < len; i++) {
        const participant = participants[i]
        ctx.fillText(
          participant.label,
          xPos,
          i * layout.heightOfBarWrap +
            (layout.heightOfBarWrap >> 1) +
            effectiveMarginTop
        )
      }
    }
  }

  function drawParticipantTicks(ctx: CanvasRenderingContext2D) {
    // Pixel-align coordinates for sharp rendering based on floored dimensions
    const scarfPlotLeft = Math.floor(LEFT_LABEL_WIDTH + marginLeft)
    const scarfPlotWidth = Math.floor(plotAreaWidth)
    const leftX = scarfPlotLeft + 0.5
    const rightX = scarfPlotLeft + scarfPlotWidth + 0.5

    // Draw the vertical Y-axis lines connecting the ticks using standard grid color
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH

    const yTop = Math.floor(effectiveMarginTop)
    const yBottom = Math.floor(participantBarsHeight + effectiveMarginTop)
    ctx.beginPath()
    ctx.moveTo(leftX, yTop)
    ctx.lineTo(leftX, yBottom)
    ctx.moveTo(rightX, yTop)
    ctx.lineTo(rightX, yBottom)
    ctx.stroke()

    // In compact mode: skip minor gridlines but draw outward axis ticks
    if (layout.isCompact) {
      const participants = data.participants
      const len = participants.length

      // Nice steps logic (same as in drawParticipantLabels)
      const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
      let step = 5
      for (const s of niceSteps) {
        if (len / s <= 10) {
          step = s
          break
        }
      }

      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH

      // Draw outward checks at the same intervals as labels
      for (let i = 0; i < len; i += step) {
        const y = alignToPixelCenter(
          i * layout.heightOfBarWrap +
            layout.heightOfBarWrap / 2 +
            effectiveMarginTop
        )
        ctx.beginPath()
        ctx.moveTo(leftX, y)
        ctx.lineTo(leftX - 5, y)
        ctx.stroke()
      }
      // Always draw the last index if not already drawn
      const lastIdx = len - 1
      if (lastIdx % step !== 0) {
        const y = alignToPixelCenter(
          lastIdx * layout.heightOfBarWrap +
            layout.heightOfBarWrap / 2 +
            effectiveMarginTop
        )
        ctx.beginPath()
        ctx.moveTo(leftX, y)
        ctx.lineTo(leftX - 5, y)
        ctx.stroke()
      }
      return
    }

    // Draw horizontal lines between participants using subtle ridgeline style
    ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
    ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH

    const participants = data.participants
    const len = participants.length

    for (let i = 0; i <= len; i++) {
      // Draw ticks exactly at bar boundaries
      const y = alignToPixelCenter(
        i * layout.heightOfBarWrap + effectiveMarginTop
      )

      // Draw full line across between participants
      ctx.beginPath()
      ctx.moveTo(leftX, y)
      ctx.lineTo(rightX, y)
      ctx.stroke()
    }
  }

  function drawRectangles(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    plotWidth: number
  ) {
    const buckets = visualRectBuckets
    if (buckets.length === 0) return

    const RECT_STRIDE = 8

    const isHighlightActive = usedHighlights.length > 0
    const highlightMask = highlightMaskByIndex

    // Local references for fast access
    const rectStyles = rectStyleArray

    // Draw normal elements using path batching
    ctx.globalAlpha = 1.0

    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      if (isDimmed) continue // Skip dimmed in this pass

      const styleSet = rectStyles[styleIdx]

      ctx.fillStyle = styleSet.normal.fill
      ctx.beginPath() // Start a massive path

      const segmentCount = buffer.length / RECT_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * RECT_STRIDE
        const xNormalized = buffer[idx]
        const pIndex = buffer[idx + 1]
        const widthNormalized = buffer[idx + 2]
        const origRectH = buffer[idx + 3]
        const origInternalY = buffer[idx + 7]

        let rectH = origRectH
        let internalY = origInternalY

        // Apply scaling when scaleFactor differs from 1 (both shrink and scale-up)
        const scale = layout.scaleFactor
        if (scale !== 1) {
          if (origRectH === SCARF_LAYOUT.NON_FIXATION_HEIGHT) {
            rectH = layout.nonFixationHeight
            internalY =
              layout.spaceAboveRect +
              layout.heightOfBar / 2 -
              layout.nonFixationHeight / 2
          } else {
            rectH = origRectH * scale
            const paddingOffset = origInternalY - SCARF_LAYOUT.SPACE_ABOVE_RECT
            internalY = layout.spaceAboveRect + paddingOffset * scale
          }
        }

        const pxX = leftX + xNormalized * plotWidth
        const pxW = widthNormalized * plotWidth
        const pxY =
          pIndex * layout.heightOfBarWrap + internalY + effectiveMarginTop

        ctx.rect(pxX, pxY, pxW, rectH)
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

      const styleSet = rectStyles[styleIdx]

      ctx.fillStyle = styleSet.normal.fill
      ctx.beginPath() // Start a massive path

      const segmentCount = buffer.length / RECT_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * RECT_STRIDE
        const xNormalized = buffer[idx]
        const pIndex = buffer[idx + 1]
        const widthNormalized = buffer[idx + 2]
        const origRectH = buffer[idx + 3]
        const origInternalY = buffer[idx + 7]

        let rectH = origRectH
        let internalY = origInternalY

        // Apply scaling when scaleFactor differs from 1 (both shrink and scale-up)
        const scale = layout.scaleFactor
        if (scale !== 1) {
          if (origRectH === SCARF_LAYOUT.NON_FIXATION_HEIGHT) {
            rectH = layout.nonFixationHeight
            internalY =
              layout.spaceAboveRect +
              layout.heightOfBar / 2 -
              layout.nonFixationHeight / 2
          } else {
            rectH = origRectH * scale
            const paddingOffset = origInternalY - SCARF_LAYOUT.SPACE_ABOVE_RECT
            internalY = layout.spaceAboveRect + paddingOffset * scale
          }
        }

        const pxX = leftX + xNormalized * plotWidth
        const pxW = widthNormalized * plotWidth
        const pxY =
          pIndex * layout.heightOfBarWrap + internalY + effectiveMarginTop

        ctx.rect(pxX, pxY, pxW, rectH)
      }

      ctx.fill() // Send everything to GPU in ONE go
    }

    // Reset alpha
    ctx.globalAlpha = 1
  }

  function drawEvents(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    plotWidth: number
  ) {
    const buckets = visualEventBuckets
    if (buckets.length === 0) return

    const EVENT_STRIDE = 5

    const isHighlightActive = usedHighlights.length > 0
    const highlightMask = highlightMaskByIndex

    // Local references for fast access
    const eventStyles = eventStyleArray

    // Loop unrolling: Explicitly handle both passes to avoid allocating [true, false] array

    // PASS 1: DIMMED (Background)
    ctx.globalAlpha = 0.15
    // Reverse order for Z-index correct stacking
    for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      // Only process if this IS a dimmed item
      if (!isDimmed) continue

      const styleSet = eventStyles[styleIdx]
      const eventColor = styleSet.normal.stroke

      const segmentCount = buffer.length / EVENT_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * EVENT_STRIDE
        const xNormalized = buffer[idx]
        const pIndex = buffer[idx + 1]
        const eventType = buffer[idx + 2] | 0

        // Determine vertical position: check for override from collision detection, otherwise use default center
        // Key matches the PACKING CONSTANT in eventLayoutOverrides (styleIdx * 1000000 + i)
        // Determine vertical position: skip expensive lookup in compact mode
        const overrideY = layout.isCompact
          ? undefined
          : eventLayoutOverrides.get(styleIdx * 1000000 + i)

        const internalY =
          overrideY !== undefined
            ? overrideY * layout.scaleFactor
            : layout.spaceAboveRect + layout.heightOfBar / 2

        const pxX = leftX + xNormalized * plotWidth
        const pxY =
          pIndex * layout.heightOfBarWrap + internalY + effectiveMarginTop

        // Size and radii for the circular markers (scaled down cap to 14px)
        const size = Math.max(7, Math.min(14, layout.heightOfBar * 0.8))
        const radius = size / 2
        const innerRadius = Math.max(2, radius * 0.4) // inner white hole / inner colored dot size

        // Outer outline is a very thin dark grey stroke (keeps visibility independent of color)
        const OUTLINE_COLOR = '#333333'
        const OUTLINE_WIDTH = 1

        // Save previous canvas state that we'll modify
        const prevAlpha = ctx.globalAlpha
        const prevFill = ctx.fillStyle
        const prevStroke = ctx.strokeStyle
        const prevLineWidth = ctx.lineWidth

        if (eventType === 0) {
          // START event: colored outer circle with a white inner dot (ring-like appearance)
          // Outer colored circle
          ctx.beginPath()
          ctx.fillStyle = eventColor
          ctx.arc(pxX, pxY, radius, 0, Math.PI * 2)
          ctx.fill()

          // Inner white hole/dot
          ctx.beginPath()
          ctx.fillStyle = '#ffffff'
          ctx.arc(pxX, pxY, innerRadius, 0, Math.PI * 2)
          ctx.fill()

          // Thin dark outline around the outer circle (drawn with full opacity to keep it visible)
          ctx.beginPath()
          ctx.lineWidth = OUTLINE_WIDTH
          ctx.lineJoin = 'miter'
          ctx.globalAlpha = 1
          ctx.strokeStyle = OUTLINE_COLOR
          ctx.arc(pxX, pxY, radius + 0.2, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          // END event: white outer circle with a colored inner dot
          // Outer white circle
          ctx.beginPath()
          ctx.fillStyle = '#ffffff'
          ctx.arc(pxX, pxY, radius, 0, Math.PI * 2)
          ctx.fill()

          // Inner colored dot
          ctx.beginPath()
          ctx.fillStyle = eventColor
          ctx.arc(pxX, pxY, innerRadius, 0, Math.PI * 2)
          ctx.fill()

          // Thin dark outline around the outer circle (drawn with full opacity to keep it visible)
          ctx.beginPath()
          ctx.lineWidth = OUTLINE_WIDTH
          ctx.lineJoin = 'miter'
          ctx.globalAlpha = 1
          ctx.strokeStyle = OUTLINE_COLOR
          ctx.arc(pxX, pxY, radius + 0.2, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Restore previous canvas drawing state
        ctx.globalAlpha = prevAlpha
        ctx.fillStyle = prevFill
        ctx.strokeStyle = prevStroke
        ctx.lineWidth = prevLineWidth
      }
    }

    // PASS 2: NORMAL (Foreground)
    ctx.globalAlpha = 1.0
    for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue

      const isDimmed =
        isHighlightActive && highlightMask
          ? highlightMask[styleIdx] !== 1
          : false

      // Only process if this is NOT a dimmed item (i.e. it is Normal)
      if (isDimmed) continue

      const styleSet = eventStyles[styleIdx]
      const eventColor = styleSet.normal.stroke

      const segmentCount = buffer.length / EVENT_STRIDE
      for (let i = 0; i < segmentCount; i++) {
        const idx = i * EVENT_STRIDE
        const xNormalized = buffer[idx]
        const pIndex = buffer[idx + 1]
        const eventType = buffer[idx + 2] | 0

        // Determine vertical position: check for override from collision detection, otherwise use default center
        // Key matches the PACKING CONSTANT in eventLayoutOverrides (styleIdx * 1000000 + i)
        // Determine vertical position: skip expensive lookup in compact mode
        const overrideY = layout.isCompact
          ? undefined
          : eventLayoutOverrides.get(styleIdx * 1000000 + i)

        const internalY =
          overrideY !== undefined
            ? overrideY * layout.scaleFactor
            : layout.spaceAboveRect + layout.heightOfBar / 2

        const pxX = leftX + xNormalized * plotWidth
        const pxY =
          pIndex * layout.heightOfBarWrap + internalY + effectiveMarginTop

        // Size and radii for the circular markers (scaled down cap to 12px)
        const size = Math.max(7, Math.min(12, layout.heightOfBar * 0.8))
        const radius = size / 2
        const innerRadius = Math.max(2, radius * 0.4) // inner white hole / inner colored dot size

        // Outer outline is a very thin dark grey stroke (keeps visibility independent of color)
        const OUTLINE_COLOR = '#333333'
        const OUTLINE_WIDTH = 1

        // Save previous canvas state that we'll modify
        const prevAlpha = ctx.globalAlpha
        const prevFill = ctx.fillStyle
        const prevStroke = ctx.strokeStyle
        const prevLineWidth = ctx.lineWidth

        if (eventType === 0) {
          // START event: colored outer circle with a white inner dot (ring-like appearance)
          // Outer colored circle
          ctx.beginPath()
          ctx.fillStyle = eventColor
          ctx.arc(pxX, pxY, radius, 0, Math.PI * 2)
          ctx.fill()

          // Inner white hole/dot
          ctx.beginPath()
          ctx.fillStyle = '#ffffff'
          ctx.arc(pxX, pxY, innerRadius, 0, Math.PI * 2)
          ctx.fill()

          // Thin dark outline around the outer circle (drawn with full opacity to keep it visible)
          ctx.beginPath()
          ctx.lineWidth = OUTLINE_WIDTH
          ctx.lineJoin = 'miter'
          ctx.globalAlpha = 1
          ctx.strokeStyle = OUTLINE_COLOR
          ctx.arc(pxX, pxY, radius + 0.2, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          // END event: white outer circle with a colored inner dot
          // Outer white circle
          ctx.beginPath()
          ctx.fillStyle = '#ffffff'
          ctx.arc(pxX, pxY, radius, 0, Math.PI * 2)
          ctx.fill()

          // Inner colored dot
          ctx.beginPath()
          ctx.fillStyle = eventColor
          ctx.arc(pxX, pxY, innerRadius, 0, Math.PI * 2)
          ctx.fill()

          // Thin dark outline around the outer circle (drawn with full opacity to keep it visible)
          ctx.beginPath()
          ctx.lineWidth = OUTLINE_WIDTH
          ctx.lineJoin = 'miter'
          ctx.globalAlpha = 1
          ctx.strokeStyle = OUTLINE_COLOR
          ctx.arc(pxX, pxY, radius + 0.2, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Restore previous canvas drawing state
        ctx.globalAlpha = prevAlpha
        ctx.fillStyle = prevFill
        ctx.strokeStyle = prevStroke
        ctx.lineWidth = prevLineWidth
      }
    }

    // Reset alpha
    ctx.globalAlpha = 1
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
        const tooltipContent = getLegendTooltipContent(
          legendItem,
          isHighlighted
        )
        const tooltipItemPos = getLegendTooltipPosition(
          legendItem,
          SCARF_LEGEND_CONFIG
        )
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
      mouseY >= effectiveMarginTop &&
      mouseY <=
        data.participants.length * layout.heightOfBarWrap + effectiveMarginTop

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
      const xNormalized = hoveredSegment.x
      const widthNormalized = hoveredSegment.width
      const pIndex = hoveredSegment.y
      const rectH = hoveredSegment.height
      const internalY = hoveredSegment.internalY

      const pxX1 = LEFT_LABEL_WIDTH + xNormalized * plotAreaWidth + marginLeft
      const pxW = widthNormalized * plotAreaWidth
      const pxY =
        pIndex * layout.heightOfBarWrap + internalY + effectiveMarginTop

      const tooltipPos = getTooltipPosition(
        canvasState,
        pxX1 + pxW,
        pxY + rectH / 2,
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
      mouseY >= effectiveMarginTop &&
      mouseY <=
        data.participants.length * layout.heightOfBarWrap +
          effectiveMarginTop &&
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

  $effect(() => {
    const deps = [
      data,
      settings,
      totalWidth,
      totalHeight,
      highlights,
      usedHighlights,
      chartWidth,
      availableHeight,
      dpiOverride,
      marginLeft,
      marginRight,
      effectiveMarginTop,
      marginBottom,
    ]

    // Schedule a render instead of immediate execution
    untrack(() => {
      // If dpiOverride changed, reinitialize the canvas with the new value
      if (canvas && canvasState.dpiOverride !== dpiOverride) {
        canvasState = setupCanvas(canvasState, canvas, dpiOverride)
      }
      canvasState = resizeCanvas(canvasState, totalWidth, totalHeight)
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

        const xNormalized = buffer[idx]
        const pIndex = buffer[idx + 1]
        const widthNormalized = buffer[idx + 2]
        const origRectH = buffer[idx + 3]
        const participantId = buffer[idx + 4]
        const segmentId = buffer[idx + 5]
        const orderId = buffer[idx + 6]
        const origInternalY = buffer[idx + 7]

        let rectH = origRectH
        let internalY = origInternalY

        // Apply scaling when scaleFactor differs from 1 (both shrink and scale-up)
        const scale = layout.scaleFactor
        if (scale !== 1) {
          if (origRectH === SCARF_LAYOUT.NON_FIXATION_HEIGHT) {
            rectH = layout.nonFixationHeight
            internalY =
              layout.spaceAboveRect +
              layout.heightOfBar / 2 -
              layout.nonFixationHeight / 2
          } else {
            rectH = origRectH * scale
            const paddingOffset = origInternalY - SCARF_LAYOUT.SPACE_ABOVE_RECT
            internalY = layout.spaceAboveRect + paddingOffset * scale
          }
        }

        const pxX = leftX + xNormalized * plotWidth
        const pxW = widthNormalized * plotWidth
        const pxY =
          pIndex * layout.heightOfBarWrap + internalY + effectiveMarginTop

        if (
          mouseX >= pxX &&
          mouseX <= pxX + pxW &&
          mouseY >= pxY &&
          mouseY <= pxY + rectH
        ) {
          return {
            x: xNormalized,
            y: pIndex,
            width: widthNormalized,
            height: rectH,
            internalY,
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
  style:pointer-events={canRender ? 'auto' : 'none'}
  width={totalWidth}
  height={totalHeight}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onmousedown={handleMouseDown}
  bind:this={canvas}
  data-component="scarfplot"
  aria-label="Scarf plot visualization"
></canvas>
