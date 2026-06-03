<script lang="ts">
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import {
    beginCanvasDrawing,
    finishCanvasDrawing,
  } from '$lib/plots/shared/canvasUtils'
  import { UI_COLORS } from '$lib/color'
  import {
    drawPlotArea,
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    type BlockedRegion,
    type CanvasExportProps,
  } from '$lib/plots/shared'
  import {
    drawCanvasPlaceholder,
    METRIC_MISSING_MESSAGE,
  } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { SCANGRAPH_LAYOUT } from '../const'
  import type { ScangraphData } from '../types'
  import { computeForceLayout, type ForceLayoutMargins, type LayoutResult, type NodePosition } from '../core/forceLayout'

  const HIGHLIGHT_COLOR = '#e53e3e'
  const HIGHLIGHT_FILL = '#fbbf24'
  const HIGHLIGHT_CONNECTED_STROKE = '#e53e3e'

  interface Props extends CanvasExportProps {
    data: ScangraphData
    threshold?: number
    highlights?: number[]
    noMetric?: boolean
    onNodeClick?: (nodeIndex: number) => void
  }

  let {
    data,
    height = 500,
    width = 500,
    threshold = 0.5,
    highlights = [],
    noMetric = false,
    onNodeClick,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  const plot = usePlot({
    render: renderCanvas,
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, threshold, highlights],
    onMouseMove: handlePlotMouseMove,
  })

  // `width`/`height` are the TOTAL canvas; the force layout fills it and insets
  // nodes by the margins. plot.plotAreaWidth/Height are the drawable content area.
  const canvasWidth = $derived(width)
  const canvasHeight = $derived(height)
  const contentWidth = $derived(plot.plotAreaWidth)
  const contentHeight = $derived(plot.plotAreaHeight)

  // Scangraph's entire content area is interactive (clickable nodes +
  // edges). There's no legend, so the plot area is the only blocked
  // region; everything outside (the margin frame around it) stays
  // clickable-to-select.
  const blockedRegions = $derived<BlockedRegion[]>([
    { x: margins.left, y: margins.top, w: contentWidth, h: contentHeight },
  ])


  const nodeRadius = $derived.by(() => {
    const n = data?.nodes.length ?? 0
    if (n === 0) return SCANGRAPH_LAYOUT.nodeRadius
    const minDim = Math.min(contentWidth, contentHeight)
    return Math.round(Math.max(3, Math.min(8, minDim / (n * 1.2))) * 10) / 10
  })

  const highlightSet = $derived(new Set(highlights))

  // Nodes connected to any highlighted node
  const connectedToHighlight = $derived.by(() => {
    const set = new Set<number>()
    if (highlightSet.size === 0 || !data) return set
    for (const link of data.links) {
      if (highlightSet.has(link.source) && !highlightSet.has(link.target)) {
        set.add(link.target)
      }
      if (highlightSet.has(link.target) && !highlightSet.has(link.source)) {
        set.add(link.source)
      }
    }
    return set
  })

  const forceMargins = $derived<ForceLayoutMargins>({
    top: margins.top,
    right: margins.right,
    bottom: margins.bottom,
    left: margins.left,
  })

  const layoutResult = $derived.by((): LayoutResult => {
    if (!data || data.nodes.length === 0)
      return { nodes: [], links: [] }
    return computeForceLayout(data, canvasWidth, canvasHeight, 500, forceMargins)
  })

  type Rect = { x: number; y: number; w: number; h: number }

  function rectsOverlap(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  function rectHitsCircle(rect: Rect, cx: number, cy: number, r: number): boolean {
    // Closest point on rect to circle center
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
    const dx = closestX - cx
    const dy = closestY - cy
    return dx * dx + dy * dy < r * r
  }

  /**
   * Label placement: above the node, sliding right then left if needed.
   *
   * For each node:
   * 1. Try centered above
   * 2. Slide right in steps until label left edge >= node center (label mostly right of node)
   * 3. Slide left in steps until label right edge <= node center (label mostly left of node)
   * 4. If all positions collide with a node circle or already-placed label, skip
   */
  function computeVisibleLabels(
    ctx: CanvasRenderingContext2D,
    nodes: NodePosition[],
    r: number,
    fontSize: number
  ): { nodeIndex: number; rect: Rect }[] {
    const gap = 3
    const labelH = fontSize + 2
    const step = 4 // px per slide step

    // Occupied: node circles + already placed labels
    const placedLabels: Rect[] = []
    const result: { nodeIndex: number; rect: Rect }[] = []

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const labelW = ctx.measureText(node.label).width
      const baseY = node.y - r - gap - labelH

      // Generate candidates: center, then slide right, then slide left
      let placed = false

      // Center position
      const centerX = node.x - labelW / 2

      // Try center first, then slide right, then slide left
      // Right: shift from center rightward until label left edge >= node.x
      // Left: shift from center leftward until label right edge <= node.x
      const maxRightShift = node.x - centerX // label.x goes up to node.x
      const maxLeftShift = (centerX + labelW) - node.x // label right edge down to node.x

      const candidates: number[] = [centerX] // start with centered

      // Slide right
      for (let s = step; s <= maxRightShift; s += step) {
        candidates.push(centerX + s)
      }
      // Snap to max right position
      if (maxRightShift > step) {
        candidates.push(centerX + maxRightShift)
      }

      // Slide left
      for (let s = step; s <= maxLeftShift; s += step) {
        candidates.push(centerX - s)
      }
      // Snap to max left position
      if (maxLeftShift > step) {
        candidates.push(centerX - maxLeftShift)
      }

      for (const rx of candidates) {
        const rect: Rect = { x: rx, y: baseY, w: labelW, h: labelH }

        // Out of canvas bounds?
        if (rect.x < margins.left || rect.y < margins.top || rect.x + rect.w > margins.left + width || rect.y + rect.h > margins.top + height) {
          continue
        }

        // Overlaps any node circle?
        let blocked = false
        for (let j = 0; j < nodes.length; j++) {
          if (rectHitsCircle(rect, nodes[j].x, nodes[j].y, r + 1)) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        // Overlaps any already-placed label?
        for (const pl of placedLabels) {
          if (rectsOverlap(rect, pl)) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        // Place it
        placedLabels.push(rect)
        result.push({ nodeIndex: i, rect })
        placed = true
        break
      }
      // If !placed, label is simply not shown (tooltip still works)
    }

    return result
  }

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    // Empty-state branches: paint onto the canvas so exports include the
    // message instead of a blank PNG/SVG.
    if (noMetric) {
      drawCanvasPlaceholder(ctx, canvasWidth, canvasHeight, METRIC_MISSING_MESSAGE)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const { nodes, links } = layoutResult

    if (nodes.length === 0) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No graph data available', canvasWidth >> 1, canvasHeight >> 1)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const r = nodeRadius

    const hasHighlights = highlightSet.size > 0

    // Draw links — thickness encodes similarity value
    const thresholdRange = 1 - threshold
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue

      const touchesHighlight =
        hasHighlights &&
        (highlightSet.has(link.source) || highlightSet.has(link.target))

      const norm = thresholdRange > 0 ? (link.value - threshold) / thresholdRange : 0
      ctx.lineWidth = 0.5 + norm * 3.5
      ctx.strokeStyle = touchesHighlight
        ? HIGHLIGHT_COLOR
        : SCANGRAPH_LAYOUT.linkColor
      ctx.globalAlpha = touchesHighlight ? 0.8 : SCANGRAPH_LAYOUT.linkOpacity
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Draw nodes
    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni]
      const isHighlighted = hasHighlights && highlightSet.has(ni)
      const isConnected = hasHighlights && connectedToHighlight.has(ni)

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)

      // Fill: highlighted = yellow, default = blue/grey
      ctx.fillStyle = isHighlighted
        ? HIGHLIGHT_FILL
        : node.degree > 0
          ? '#4a90d9'
          : UI_COLORS.TEXT_SECONDARY
      ctx.fill()

      // Stroke: highlighted = red, connected-to-highlighted = red, default = white
      ctx.strokeStyle =
        isHighlighted || isConnected ? HIGHLIGHT_CONNECTED_STROKE : '#fff'
      ctx.lineWidth = isHighlighted || isConnected ? 2 : 1.5
      ctx.stroke()
    }

    // Draw outline around the content area (before labels so labels render on top).
    // Inset by 1px on right/bottom: the scangraph fills the entire canvas with no
    // axis-label margin, so a full-size rect would draw its right/bottom stroke
    // half a pixel beyond the canvas and get cropped.
    drawPlotArea(ctx, {
      x: margins.left,
      y: margins.top,
      width: contentWidth - 1,
      height: contentHeight - 1,
    })

    // Draw labels — last step in rendering
    const fontSize = Math.max(8, Math.min(11, Math.round(r * 1.6)))
    ctx.font = `${fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const visibleLabels = computeVisibleLabels(ctx, nodes, r, fontSize)
    for (const lbl of visibleLabels) {
      const node = nodes[lbl.nodeIndex]
      ctx.fillText(node.label, lbl.rect.x, lbl.rect.y)
    }

    finishCanvasDrawing(plot.canvasState)
  }

  const MAX_TOOLTIP_CONNECTIONS = 4
  const MAX_CONNECTION_LABEL_CHARS = 18

  function clipLabel(label: string): string {
    return label.length > MAX_CONNECTION_LABEL_CHARS
      ? label.slice(0, MAX_CONNECTION_LABEL_CHARS - 1) + '…'
      : label
  }

  function getConnectionItems(nodeId: number): { key: string; value: string }[] {
    if (!data) return []

    const connections: { label: string; value: number }[] = []
    for (const link of data.links) {
      if (link.source === nodeId) {
        const target = data.nodes[link.target]
        if (target) connections.push({ label: target.label, value: link.value })
      } else if (link.target === nodeId) {
        const source = data.nodes[link.source]
        if (source) connections.push({ label: source.label, value: link.value })
      }
    }

    connections.sort((a, b) => b.value - a.value)

    const items: { key: string; value: string }[] = []
    const shown = Math.min(connections.length, MAX_TOOLTIP_CONNECTIONS)
    for (let i = 0; i < shown; i++) {
      items.push({
        key: '',
        value: `${connections[i].value.toFixed(3)} ${clipLabel(connections[i].label)}`,
      })
    }

    const remaining = connections.length - shown
    if (remaining > 0) {
      items.push({
        key: '',
        value: `+ ${remaining} connection${remaining > 1 ? 's' : ''} …`,
      })
    }

    return items
  }

  // Tracked from the last hover so the click handler needs no coordinates.
  let hoveredNode: NodePosition | null = null

  function findNodeAt(mx: number, my: number): NodePosition | null {
    const hitR = nodeRadius + 4
    const hitR2 = hitR * hitR
    for (const node of layoutResult.nodes) {
      const dx = mx - node.x
      const dy = my - node.y
      if (dx * dx + dy * dy <= hitR2) return node
    }
    return null
  }

  // Coordinates arrive already scaled from usePlot; null marks mouse-leave.
  function handlePlotMouseMove(
    mx: number | null,
    my: number | null,
    _isOver: boolean
  ) {
    if (mx === null || my === null) {
      hoveredNode = null
      plot.hideTooltip(0)
      plot.setCursor('default')
      return
    }

    hoveredNode = findNodeAt(mx, my)

    if (hoveredNode) {
      const connectionItems = getConnectionItems(hoveredNode.id)
      const content: { key: string; value: string }[] = [
        { key: 'Participant', value: hoveredNode.label },
      ]
      if (connectionItems.length > 0) {
        content.push({ key: 'Connections', value: connectionItems[0].value })
        for (let i = 1; i < connectionItems.length; i++) {
          content.push(connectionItems[i])
        }
      }

      plot.showTooltip(
        'scangraph-tooltip',
        content,
        hoveredNode.x + 10,
        hoveredNode.y,
        { x: 10, y: 0 },
        160
      )
    } else {
      plot.hideTooltip(0)
    }

    plot.setCursor(hoveredNode ? 'pointer' : 'default')
  }

  function handleClick() {
    if (hoveredNode && onNodeClick) onNodeClick(hoveredNode.id)
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
  onclick={handleClick}
></canvas>
