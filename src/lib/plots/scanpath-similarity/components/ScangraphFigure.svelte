<script lang="ts">
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { distanceToSegment } from '$lib/shared/utils/mathUtils'
  import { UI_COLORS } from '$lib/color'
  import {
    drawPlotArea,
    usePlot,
    canvasBlockSelect,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
  import {
    METRIC_MISSING_MESSAGE,
    cannotFitPlaceholder,
  } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    CROSSHAIR_COLOR,
    markCrosshairNode,
    strokeCrosshairRing,
  } from '$lib/plots/shared/canvasUtils'
  import {
    cursorRows,
    type PlotCursorPort,
  } from '$lib/plots/shared/plotCursor.svelte'
  import { SCANGRAPH_LAYOUT } from '../const'
  import type { ScangraphData } from '../types'
  import { computeForceLayout, type LayoutResult, type NodePosition } from '../core/forceLayout'

  const HIGHLIGHT_COLOR = '#e53e3e'
  const HIGHLIGHT_FILL = '#fbbf24'
  const HIGHLIGHT_CONNECTED_STROKE = '#e53e3e'
  const MIN_NODE_SPACING = 3

  interface Props extends CanvasExportProps {
    data: ScangraphData
    threshold?: number
    highlights?: number[]
    noMetric?: boolean
    onNodeClick?: (nodeIndex: number) => void
    /** Participant id per node index — the PLOT CURSOR's participant channel. */
    participantIds?: number[]
    /** Shared PLOT CURSOR (screen-only; export renders without one). */
    plotCursor?: PlotCursorPort | null
  }

  let {
    data,
    height = 500,
    width = 500,
    threshold = 0.5,
    highlights = [],
    noMetric = false,
    onNodeClick,
    participantIds,
    plotCursor = null,
    margin = 0,
  }: Props = $props()

  /**
   * What the pointer is on. A NODE is one participant; an EDGE is a pair, exactly
   * like a similarity-matrix cell, so it designates both endpoints.
   */
  type ScangraphHover =
    | { kind: 'node'; node: NodePosition }
    | { kind: 'edge'; source: number; target: number; value: number }

  const plot = usePlot<ScangraphHover>({
    width: () => width,
    height: () => height,
    margin: () => margin,
    deps: () => [data, threshold, highlights, noMetric],
    placeholder: () =>
      noMetric
        ? METRIC_MISSING_MESSAGE
        : (data?.nodes.length ?? 0) === 0
          ? 'No graph data available'
          : null,
    fit: frame => {
      const n = data?.nodes.length ?? 0
      if (n === 0) return null
      const minDim = Math.min(frame.width, frame.height)
      if (minDim / (n * 1.2) >= MIN_NODE_SPACING) return null
      return cannotFitPlaceholder('size', [
        'Reduce the number of participants in Plot Settings > Participants',
      ])
    },
    // The force layout fills the whole canvas and insets nodes by the export
    // margins itself, so the frame's rect (= content area) is used only for the
    // outline + the default blocked region.
    gutters: () => ({}),
    clipData: false,
    drawData: drawGraph,
    drawOverlay: drawNodeMarks,
    hitTest: computeHit,
    // Live reads of the hovered INDICES, like every other publisher: an undo under
    // a resting pointer re-derives who they are, or reads back empty. An edge
    // publishes a sorted PAIR, the same set a similarity-matrix cell publishes.
    onHover: hover => {
      const at = () => {
        const ids = participantIds ?? []
        if (hover === null) return []
        if (hover.kind === 'node') return ids.slice(hover.node.id, hover.node.id + 1)
        return [ids[hover.source], ids[hover.target]]
          .filter((id): id is number => id !== undefined)
          .sort((x, y) => x - y)
      }
      plotCursor?.publish(at().length === 0 ? null : { participants: at })
    },
    overlayDeps: (): string => cursorNodesKey,
  })

  const cursorNodes = $derived(
    cursorRows(participantIds ?? [], plotCursor?.participants ?? [])
  )
  const cursorNodesKey = $derived(cursorNodes.join(','))

  /**
   * What is designated RIGHT NOW, and whether the designation is a PAIR. One
   * derived for all three sources — this plot's node hover, this plot's edge
   * hover, or the cursor — and everything below reads only this, never which
   * source filled it. That is what makes p1 look identical hovered here and
   * hovered in a scarf.
   *
   * `pair` is what an edge hover means: the relation itself, so the marks stay on
   * the two endpoints and their one shared edge. A node hover instead asks "who is
   * like this participant", so it fans out to the whole neighbourhood.
   */
  const designated = $derived.by(() => {
    const hovered = plot.hover.data
    if (hovered?.kind === 'edge') {
      return { nodes: new Set([hovered.source, hovered.target]), pair: true }
    }
    if (hovered?.kind === 'node') {
      return { nodes: new Set([hovered.node.id]), pair: false }
    }
    return { nodes: new Set(cursorNodes), pair: false }
  })

  /** Nodes adjacent to `of`, itself excluded. */
  function neighboursOf(of: ReadonlySet<number>): Set<number> {
    const set = new Set<number>()
    if (of.size === 0 || !data) return set
    for (const link of data.links) {
      if (of.has(link.source) && !of.has(link.target)) set.add(link.target)
      if (of.has(link.target) && !of.has(link.source)) set.add(link.source)
    }
    return set
  }

  /**
   * A designated node's neighbourhood, in two tiers — a graph's own answer to
   * "who is this?", which is why the mark is richer here than a row outline: the
   * node itself gets the halo + ring, its edges keep their similarity thickness in
   * the cursor colour, and its neighbours get the ring ALONE (adjacent, not
   * designated). The cursor still carries only the designated participant; the
   * neighbourhood is this plot's rendering of it, never extra channel content.
   */
  function drawNodeMarks(ctx: CanvasRenderingContext2D) {
    const { nodes: marked, pair } = designated
    if (marked.size === 0) return
    const { nodes, links } = layoutResult
    const r = nodeRadius + 3

    // `&&` for a pair (that one edge), `||` for a participant (all of its edges) —
    // the same operator distinction the matrix highlight draws.
    ctx.save()
    ctx.strokeStyle = CROSSHAIR_COLOR
    for (const link of links) {
      const a = marked.has(link.source)
      const b = marked.has(link.target)
      if (pair ? !(a && b) : !(a || b)) continue
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      ctx.lineWidth = linkWidth(link.value)
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }
    ctx.restore()

    // A pair designates the relation, not a neighbourhood: no second tier, or the
    // two endpoints would be buried among their other neighbours.
    if (!pair) {
      for (const index of neighboursOf(marked)) {
        const node = nodes[index]
        if (node) strokeCrosshairRing(ctx, node.x, node.y, r)
      }
    }
    for (const index of marked) {
      const node = nodes[index]
      if (node) markCrosshairNode(ctx, node.x, node.y, r)
    }
  }

  const nodeRadius = $derived.by(() => {
    const n = data?.nodes.length ?? 0
    if (n === 0) return SCANGRAPH_LAYOUT.nodeRadius
    const minDim = Math.min(plot.frame.width, plot.frame.height)
    return Math.round(Math.max(3, Math.min(8, minDim / (n * 1.2))) * 10) / 10
  })

  /** Link thickness encodes similarity — one rule for the data pass and the marks. */
  const linkWidth = (value: number) => {
    const range = 1 - threshold
    return 0.5 + (range > 0 ? (value - threshold) / range : 0) * 3.5
  }

  const highlightSet = $derived(new Set(highlights))

  const connectedToHighlight = $derived(neighboursOf(highlightSet))

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
    const contentW = Math.max(1, width - margin * 2)
    const contentH = Math.max(1, height - margin * 2)
    const sx = contentW / CANON
    const sy = contentH / CANON
    const nodes = nl.nodes.map(n => ({
      ...n,
      x: margin + n.x * sx,
      y: margin + n.y * sy,
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
          rect.x < margin ||
          rect.y < margin ||
          rect.x + rect.w > margin + width ||
          rect.y + rect.h > margin + height
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

    // Links — thickness encodes similarity value (see `linkWidth`, shared with the
    // overlay marks so an emphasised edge keeps its similarity reading).
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      const touchesHighlight =
        hasHighlights && (highlightSet.has(link.source) || highlightSet.has(link.target))
      ctx.lineWidth = linkWidth(link.value)
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

  const EDGE_HIT_TOLERANCE = 4

  /**
   * The nearest link under the pointer, or null. Tolerance is measured from the
   * stroke's EDGE, so a thick (highly similar) link is as easy to hit as it looks.
   * Nodes are tested first by the caller, so an endpoint never resolves to a link.
   */
  function findEdgeAt(mx: number, my: number) {
    const { nodes, links } = layoutResult
    let best: (typeof links)[number] | null = null
    let bestSlack = EDGE_HIT_TOLERANCE
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      const slack =
        distanceToSegment(mx, my, s.x, s.y, t.x, t.y) - linkWidth(link.value) / 2
      if (slack < bestSlack) {
        bestSlack = slack
        best = link
      }
    }
    return best
  }

  /**
   * Crosshair across the WHOLE plot area, not only over nodes. Track-only (empty
   * content = no tooltip) and carrying NO node, so it marks nothing, clicks
   * nothing and — unlike recurrence's masked-cell hit — publishes nothing: empty
   * graph space designates no participant. Module-stable identity, so hovering it
   * schedules no repaint.
   */
  const EMPTY_HIT: FrameHit<ScangraphHover> = {
    tooltipId: 'scangraph-tooltip',
    content: [],
    anchorX: 0,
    anchorY: 0,
    cursor: 'crosshair',
  }

  function computeHit(mx: number, my: number): FrameHit<ScangraphHover> | null {
    // Nodes win: an endpoint is a participant, not the pair it happens to sit on.
    const node = findNodeAt(mx, my)
    if (node) {
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
        // Crosshair, like every other plot's data area; the node stays clickable.
        cursor: 'crosshair',
        data: { kind: 'node', node },
      }
    }

    // The pair itself: the one place this plot states a similarity VALUE, which
    // until now was readable only as stroke thickness.
    const link = findEdgeAt(mx, my)
    if (!link) return EMPTY_HIT
    const s = layoutResult.nodes[link.source]
    const t = layoutResult.nodes[link.target]
    return {
      tooltipId: 'scangraph-tooltip',
      content: [
        { key: 'Participants', value: `${clipLabel(s.label)} ↔ ${clipLabel(t.label)}` },
        { key: 'Similarity', value: link.value.toFixed(3) },
      ],
      anchorX: (s.x + t.x) / 2,
      anchorY: (s.y + t.y) / 2,
      offset: { x: 10, y: 0 },
      tooltipWidth: 160,
      cursor: 'crosshair',
      data: { kind: 'edge', source: link.source, target: link.target, value: link.value },
    }
  }

  function handleClick() {
    // The harness tracks the hover, so the click needs no coordinates. Only a node
    // toggles the persisted highlight; a pair has nothing to persist.
    const hovered = plot.hover.data
    if (hovered?.kind === 'node' && onNodeClick) onNodeClick(hovered.node.id)
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  onclick={handleClick}
></canvas>
