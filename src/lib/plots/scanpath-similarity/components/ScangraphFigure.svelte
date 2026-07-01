<script lang="ts">
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { UI_COLORS } from '$lib/color'
  import {
    drawPlotArea,
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
  import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { SCANGRAPH_LAYOUT } from '../const'
  import type { ScangraphData } from '../types'
  import { computeForceLayout, type LayoutResult, type NodePosition } from '../core/forceLayout'

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

  const plot = usePlot<NodePosition>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, threshold, highlights],
    placeholder: () =>
      noMetric
        ? METRIC_MISSING_MESSAGE
        : (data?.nodes.length ?? 0) === 0
          ? 'No graph data available'
          : null,
    // The force layout fills the whole canvas and insets nodes by the export
    // margins itself, so the frame's rect (= content area) is used only for the
    // outline + the default blocked region.
    gutters: () => ({}),
    clipData: false,
    drawData: drawGraph,
    hitTest: computeHit,
    onHoverChange: (hit) => {
      hoveredNode = hit?.data ?? null
      return false // no hover overlay — tooltip only, no redraw
    },
  })

  const nodeRadius = $derived.by(() => {
    const n = data?.nodes.length ?? 0
    if (n === 0) return SCANGRAPH_LAYOUT.nodeRadius
    const minDim = Math.min(plot.frame.width, plot.frame.height)
    return Math.round(Math.max(3, Math.min(8, minDim / (n * 1.2))) * 10) / 10
  })

  const highlightSet = $derived(new Set(highlights))

  const connectedToHighlight = $derived.by(() => {
    const set = new Set<number>()
    if (highlightSet.size === 0 || !data) return set
    for (const link of data.links) {
      if (highlightSet.has(link.source) && !highlightSet.has(link.target)) set.add(link.target)
      if (highlightSet.has(link.target) && !highlightSet.has(link.source)) set.add(link.source)
    }
    return set
  })

  // Canonical square the force sim runs in. Fixed so the (expensive) simulation
  // is independent of the plot's pixel size.
  const CANON = 1000

  // The 500-iteration O(P²)/iter force simulation, keyed ONLY on `data` — NOT on
  // width/height/margins. Previously it sat in the same derive as the pixel
  // mapping, so every resize frame re-ran the full simulation (and re-scattered
  // the seed, making nodes jump). Now a resize never re-simulates.
  const normalizedLayout = $derived.by((): LayoutResult => {
    if (!data || data.nodes.length === 0) return { nodes: [], links: [] }
    return computeForceLayout(data, CANON, CANON, 500)
  })

  // Cheap O(P) affine map of the canonical positions into the current content
  // area. Re-runs on resize, but only rescales — positions stay stable (no jump).
  const layoutResult = $derived.by((): LayoutResult => {
    const nl = normalizedLayout
    if (nl.nodes.length === 0) return nl
    const contentW = Math.max(1, width - margins.left - margins.right)
    const contentH = Math.max(1, height - margins.top - margins.bottom)
    const sx = contentW / CANON
    const sy = contentH / CANON
    const nodes = nl.nodes.map(n => ({
      ...n,
      x: margins.left + n.x * sx,
      y: margins.top + n.y * sy,
    }))
    return { nodes, links: nl.links }
  })

  type Rect = { x: number; y: number; w: number; h: number }

  function rectsOverlap(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  function rectHitsCircle(rect: Rect, cx: number, cy: number, r: number): boolean {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
    const dx = closestX - cx
    const dy = closestY - cy
    return dx * dx + dy * dy < r * r
  }

  /**
   * Label placement: above the node, sliding right then left if needed. Skips a
   * label that can't be placed without colliding with a node or another label
   * (the tooltip still works for those).
   */
  function computeVisibleLabels(
    ctx: CanvasRenderingContext2D,
    nodes: NodePosition[],
    r: number,
    fontSize: number
  ): { nodeIndex: number; rect: Rect }[] {
    const gap = 3
    const labelH = fontSize + 2
    const step = 4

    const placedLabels: Rect[] = []
    const result: { nodeIndex: number; rect: Rect }[] = []

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const labelW = ctx.measureText(node.label).width
      const baseY = node.y - r - gap - labelH
      const centerX = node.x - labelW / 2
      const maxRightShift = node.x - centerX
      const maxLeftShift = centerX + labelW - node.x

      const candidates: number[] = [centerX]
      for (let s = step; s <= maxRightShift; s += step) candidates.push(centerX + s)
      if (maxRightShift > step) candidates.push(centerX + maxRightShift)
      for (let s = step; s <= maxLeftShift; s += step) candidates.push(centerX - s)
      if (maxLeftShift > step) candidates.push(centerX - maxLeftShift)

      for (const rx of candidates) {
        const rect: Rect = { x: rx, y: baseY, w: labelW, h: labelH }
        if (
          rect.x < margins.left ||
          rect.y < margins.top ||
          rect.x + rect.w > margins.left + width ||
          rect.y + rect.h > margins.top + height
        ) {
          continue
        }
        let blocked = false
        for (let j = 0; j < nodes.length; j++) {
          if (rectHitsCircle(rect, nodes[j].x, nodes[j].y, r + 1)) {
            blocked = true
            break
          }
        }
        if (blocked) continue
        for (const pl of placedLabels) {
          if (rectsOverlap(rect, pl)) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        placedLabels.push(rect)
        result.push({ nodeIndex: i, rect })
        break
      }
    }
    return result
  }

  function drawGraph(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const { nodes, links } = layoutResult
    const r = nodeRadius
    const hasHighlights = highlightSet.size > 0

    // Links — thickness encodes similarity value
    const thresholdRange = 1 - threshold
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      const touchesHighlight =
        hasHighlights && (highlightSet.has(link.source) || highlightSet.has(link.target))
      const norm = thresholdRange > 0 ? (link.value - threshold) / thresholdRange : 0
      ctx.lineWidth = 0.5 + norm * 3.5
      ctx.strokeStyle = touchesHighlight ? HIGHLIGHT_COLOR : SCANGRAPH_LAYOUT.linkColor
      ctx.globalAlpha = touchesHighlight ? 0.8 : SCANGRAPH_LAYOUT.linkOpacity
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Nodes
    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni]
      const isHighlighted = hasHighlights && highlightSet.has(ni)
      const isConnected = hasHighlights && connectedToHighlight.has(ni)
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = isHighlighted
        ? HIGHLIGHT_FILL
        : node.degree > 0
          ? '#4a90d9'
          : UI_COLORS.TEXT_SECONDARY
      ctx.fill()
      ctx.strokeStyle = isHighlighted || isConnected ? HIGHLIGHT_CONNECTED_STROKE : '#fff'
      ctx.lineWidth = isHighlighted || isConnected ? 2 : 1.5
      ctx.stroke()
    }

    // Outline around the content area. Inset by 1px right/bottom: the graph fills
    // the canvas with no axis margin, so a full-size rect would crop its stroke.
    drawPlotArea(ctx, {
      x: frame.x,
      y: frame.y,
      width: frame.width - 1,
      height: frame.height - 1,
    })

    // Labels — last, on top.
    const fontSize = Math.max(8, Math.min(11, Math.round(r * 1.6)))
    ctx.font = `${fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const lbl of computeVisibleLabels(ctx, nodes, r, fontSize)) {
      ctx.fillText(nodes[lbl.nodeIndex].label, lbl.rect.x, lbl.rect.y)
    }
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
      items.push({ key: '', value: `${connections[i].value.toFixed(3)} ${clipLabel(connections[i].label)}` })
    }
    const remaining = connections.length - shown
    if (remaining > 0) {
      items.push({ key: '', value: `+ ${remaining} connection${remaining > 1 ? 's' : ''} …` })
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

  function computeHit(mx: number, my: number): FrameHit<NodePosition> | null {
    const node = findNodeAt(mx, my)
    if (!node) return null
    const connectionItems = getConnectionItems(node.id)
    const content: FrameHit['content'] = [{ key: 'Participant', value: node.label }]
    if (connectionItems.length > 0) {
      content.push({ key: 'Connections', value: connectionItems[0].value })
      for (let i = 1; i < connectionItems.length; i++) content.push(connectionItems[i])
    }
    return {
      tooltipId: 'scangraph-tooltip',
      content,
      anchorX: node.x + 10,
      anchorY: node.y,
      offset: { x: 10, y: 0 },
      tooltipWidth: 160,
      cursor: 'pointer',
      data: node,
    }
  }

  function handleClick() {
    if (hoveredNode && onNodeClick) onNodeClick(hoveredNode.id)
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  onclick={handleClick}
></canvas>
