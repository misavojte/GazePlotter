/**
 * The scangraph kit: Scanpath Similarity's graph view. Participants are nodes
 * placed by a force layout; a link joins two participants whose similarity
 * clears the threshold, its thickness encoding the value. Persisted highlights
 * (clicked nodes) and the selected clique are emphasised in the data layer; the
 * hover and the PLOT CURSOR mark a node's neighbourhood in the overlay.
 */
import { SYSTEM_SANS_SERIF_SMALL_STACK } from '$lib/shared/textMeasure'
import { UI_COLORS } from '$lib/color'
import {
  CROSSHAIR_COLOR,
  markCrosshairNode,
  strokeCrosshairRing,
} from '$lib/plots/shared/canvasUtils'
import { PLOT_BORDER_PX } from '$lib/plots/shared/const'
import { cursorRows } from '$lib/plots/shared/cursorMarks'
import {
  METRIC_MISSING_MESSAGE,
  NO_PARTICIPANTS_MESSAGE,
  cannotFitPlaceholder,
} from '$lib/plots/shared/drawCanvasPlaceholder'
import { trackOnlyHit, type FrameHit, type PlotFrame } from '$lib/plots/shared/frame'
import { defineKit, memoByRef } from '$lib/plots/shared/kit'
import { SCANGRAPH_LAYOUT, SCANPATH_SIMILARITY_DEFAULTS } from '../const'
import type { ScangraphData } from '../types'
import {
  computeForceLayout,
  distanceToSegment,
  type LayoutResult,
  type NodePosition,
} from './forceLayout'
import type { ScangraphInput } from './view'

const HIGHLIGHT_COLOR = '#e53e3e'
const HIGHLIGHT_FILL = '#fbbf24'
const HIGHLIGHT_CONNECTED_STROKE = '#e53e3e'
/** Alpha for everything outside an active clique — the clique reads by the
 *  rest receding, not by extra marks on non-members. */
const DIM_ALPHA = 0.25
const MIN_NODE_SPACING = 3

/**
 * What the pointer is on. A NODE is one participant; an EDGE is a pair, exactly
 * like a similarity-matrix cell, so it designates both endpoints.
 */
export type ScangraphHover =
  | { kind: 'node'; node: NodePosition }
  | { kind: 'edge'; source: number; target: number; value: number }

// Canonical square the force sim runs in. Fixed so the (expensive) simulation
// is independent of the plot's pixel size.
const CANON = 1000

// The 500-iteration O(P²)/iter force simulation, keyed ONLY on the data
// object, never on the frame: a resize only rescales (no re-simulation, no
// re-scattered seed making nodes jump).
const normalizedLayout = memoByRef(
  (data: ScangraphData): LayoutResult =>
    data.nodes.length === 0 ? { nodes: [], links: [] } : computeForceLayout(data, CANON, CANON, 500)
)

/** Nodes adjacent to `of`, itself excluded. */
function neighboursOf(data: ScangraphData, of: ReadonlySet<number>): Set<number> {
  const set = new Set<number>()
  if (of.size === 0) return set
  for (const link of data.links) {
    if (of.has(link.source) && !of.has(link.target)) set.add(link.target)
    if (of.has(link.target) && !of.has(link.source)) set.add(link.source)
  }
  return set
}

/** Link thickness encodes similarity — one rule for the data pass and the marks. */
function linkWidth(threshold: number, value: number): number {
  const range = 1 - threshold
  return 0.5 + (range > 0 ? (value - threshold) / range : 0) * 3.5
}

/**
 * Stroke s→t with each end pulled back by its rim, so the line stops at a
 * mark's or a translucent node's boundary instead of running under it to the
 * centre. Rims that would consume the whole segment fall back to
 * centre-to-centre: dropping the edge would read as "not linked".
 */
function strokeTrimmedLink(
  ctx: CanvasRenderingContext2D,
  s: NodePosition,
  t: NodePosition,
  rimS: number,
  rimT: number
) {
  const dx = t.x - s.x
  const dy = t.y - s.y
  const len = Math.hypot(dx, dy)
  ctx.beginPath()
  if (len <= rimS + rimT) {
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(t.x, t.y)
  } else {
    const ux = dx / len
    const uy = dy / len
    ctx.moveTo(s.x + ux * rimS, s.y + uy * rimS)
    ctx.lineTo(t.x - ux * rimT, t.y - uy * rimT)
  }
  ctx.stroke()
}

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
 * (the tooltip still works for those). `priority` nodes place FIRST — an
 * emphasised node must not lose its name to a plain neighbour's label.
 */
function computeVisibleLabels(
  ctx: CanvasRenderingContext2D,
  frame: PlotFrame,
  nodes: NodePosition[],
  r: number,
  fontSize: number,
  priority: ReadonlySet<number>
): { nodeIndex: number; rect: Rect }[] {
  const gap = 3
  const labelH = fontSize + 2
  const step = 4

  const placedLabels: Rect[] = []
  const result: { nodeIndex: number; rect: Rect }[] = []

  const order: number[] = []
  for (let i = 0; i < nodes.length; i++) if (priority.has(i)) order.push(i)
  for (let i = 0; i < nodes.length; i++) if (!priority.has(i)) order.push(i)

  for (const i of order) {
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
      const f = frame
      if (rect.x < f.x || rect.y < f.y || rect.x + rect.w > f.right || rect.y + rect.h > f.bottom) continue
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

const MAX_TOOLTIP_CONNECTIONS = 4
const MAX_CONNECTION_LABEL_CHARS = 18

function clipLabel(label: string): string {
  return label.length > MAX_CONNECTION_LABEL_CHARS
    ? label.slice(0, MAX_CONNECTION_LABEL_CHARS - 1) + '…'
    : label
}

function getConnectionItems(
  data: ScangraphData,
  nodeId: number
): { key: string; value: string }[] {
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

function buildScene(input: ScangraphInput, frame: PlotFrame) {
  const data = input.data
  const n = data.nodes.length
  const nodeRadius =
    n === 0
      ? SCANGRAPH_LAYOUT.nodeRadius
      : Math.round(Math.max(3, Math.min(8, Math.min(frame.width, frame.height) / (n * 1.2))) * 10) / 10

  const nl = normalizedLayout(data)
  const sx = Math.max(1, frame.width) / CANON
  const sy = Math.max(1, frame.height) / CANON
  const nodes =
    nl.nodes.length === 0
      ? nl.nodes
      : nl.nodes.map(node => ({ ...node, x: frame.x + node.x * sx, y: frame.y + node.y * sy }))

  const { participantIds } = input
  const highlightSet = new Set(cursorRows(participantIds, input.highlightedParticipants ?? []))
  return {
    data,
    nodes,
    links: nl.links,
    nodeRadius,
    threshold: input.settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold,
    highlightSet,
    connectedToHighlight: neighboursOf(data, highlightSet),
    cliqueSet: new Set(input.cliqueMembers),
    participantIds,
  }
}

type ScangraphScene = ReturnType<typeof buildScene>

/** Full-strength while a clique is active: the clique itself plus the manual
 *  neighbourhood emphasis, which stays readable on top of the dim. */
function nodeEmphasised(scene: ScangraphScene, ni: number): boolean {
  return scene.cliqueSet.has(ni) || scene.highlightSet.has(ni) || scene.connectedToHighlight.has(ni)
}

const EDGE_HIT_TOLERANCE = 4

/**
 * Crosshair across the WHOLE plot area, not only over nodes. Track-only (empty
 * content = no tooltip) and carrying NO node, so it marks nothing, clicks
 * nothing and — unlike recurrence's masked-cell hit — publishes nothing: empty
 * graph space designates no participant. Module-stable identity, so hovering it
 * schedules no repaint.
 */
const EMPTY_HIT = trackOnlyHit<ScangraphHover>()

export const scangraphKit = defineKit<ScangraphInput, ScangraphHover>()({
  label: 'ScanGraph visualization',
  clip: false,

  // No axes, only the outline. The border pixel is padded right and bottom,
  // where a full-size rect would crop it; the force layout fills the frame.
  chrome: input => ({
    axes: {},
    gutters: { pad: { right: PLOT_BORDER_PX, bottom: PLOT_BORDER_PX } },
    placeholder: input.noMetric
      ? METRIC_MISSING_MESSAGE
      : input.data.nodes.length === 0
        ? NO_PARTICIPANTS_MESSAGE
        : null,
  }),

  scene: (input, { frame }) => buildScene(input, frame),

  fit: (scene, { frame }) => {
    const n = scene.data.nodes.length
    if (n === 0) return null
    const minDim = Math.min(frame.width, frame.height)
    if (minDim / (n * 1.2) >= MIN_NODE_SPACING) return null
    return cannotFitPlaceholder('size', [
      'Reduce the number of participants in Plot Settings > Participants',
    ])
  },

  draw: (ctx, scene) => {
    const { nodes, links, nodeRadius: r, threshold, highlightSet, cliqueSet } = scene
    const hasHighlights = highlightSet.size > 0
    const hasClique = cliqueSet.size > 0

    // Links in two passes, so emphasis never sits under plain strokes: plain
    // first (receding while a clique is active), then the intra-clique edges
    // and the manual highlights' edges in the highlight colour. An edge LEAVING
    // the clique stays plain: the clique is its members and their mutual edges.
    // Edge ends stop at a dimmed (translucent) node's outer rim: radius plus
    // half its 1.5px outline. Opaque endpoints stay centre-to-centre, occluded.
    const dimRim = hasClique ? r + 0.75 : 0
    const emphasised: typeof links = []
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      const intraClique =
        hasClique && cliqueSet.has(link.source) && cliqueSet.has(link.target)
      const touchesHighlight =
        hasHighlights && (highlightSet.has(link.source) || highlightSet.has(link.target))
      if (intraClique || touchesHighlight) {
        emphasised.push(link)
        continue
      }
      ctx.lineWidth = linkWidth(threshold, link.value)
      ctx.strokeStyle = SCANGRAPH_LAYOUT.linkColor
      ctx.globalAlpha = hasClique
        ? SCANGRAPH_LAYOUT.linkOpacity * DIM_ALPHA
        : SCANGRAPH_LAYOUT.linkOpacity
      strokeTrimmedLink(
        ctx,
        s,
        t,
        nodeEmphasised(scene, link.source) ? 0 : dimRim,
        nodeEmphasised(scene, link.target) ? 0 : dimRim
      )
    }
    // Centre-to-centre: both endpoints of an emphasised edge are themselves
    // emphasised, so they stay opaque and occlude the stroke.
    ctx.strokeStyle = HIGHLIGHT_COLOR
    ctx.globalAlpha = 0.8
    for (const link of emphasised) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      ctx.lineWidth = linkWidth(threshold, link.value)
      strokeTrimmedLink(ctx, s, t, 0, 0)
    }
    ctx.globalAlpha = 1

    // Nodes — clique members and manual highlights fill amber; while a clique
    // is active every unemphasised node recedes with its links.
    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni]
      const isFilled = highlightSet.has(ni) || (hasClique && cliqueSet.has(ni))
      const isStroked =
        isFilled || (hasHighlights && scene.connectedToHighlight.has(ni))
      ctx.globalAlpha = hasClique && !nodeEmphasised(scene, ni) ? DIM_ALPHA : 1
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = isFilled
        ? HIGHLIGHT_FILL
        : node.degree > 0
          ? '#4a90d9'
          : UI_COLORS.TEXT_SECONDARY
      ctx.fill()
      ctx.strokeStyle = isStroked ? HIGHLIGHT_CONNECTED_STROKE : '#fff'
      ctx.lineWidth = isStroked ? 2 : 1.5
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  // Labels on top of the outline. Emphasised nodes place first and keep full
  // strength; the rest recede with their nodes while a clique is active.
  drawAboveAxes: (ctx, scene, frame) => {
    const { nodes, nodeRadius: r, cliqueSet, highlightSet } = scene
    const hasClique = cliqueSet.size > 0
    const priority = new Set<number>([...cliqueSet, ...highlightSet])
    const fontSize = Math.max(8, Math.min(11, Math.round(r * 1.6)))
    ctx.font = `${fontSize}px ${SYSTEM_SANS_SERIF_SMALL_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const lbl of computeVisibleLabels(ctx, frame, nodes, r, fontSize, priority)) {
      ctx.globalAlpha = hasClique && !nodeEmphasised(scene, lbl.nodeIndex) ? DIM_ALPHA : 1
      ctx.fillText(nodes[lbl.nodeIndex].label, lbl.rect.x, lbl.rect.y)
    }
    ctx.globalAlpha = 1
  },

  overlay: {
    // The cursor's participants as node indices: the overlay repaints only when
    // the marked nodes change.
    key: (scene, cursor) => cursorRows(scene.participantIds, cursor.participants).join(','),

    /**
     * A designated node's neighbourhood, in two tiers — a graph's own answer to
     * "who is this?", which is why the mark is richer here than a row outline: the
     * node itself gets the halo + ring, its edges keep their similarity thickness in
     * the cursor colour, and its neighbours get the ring ALONE (adjacent, not
     * designated). The cursor still carries only the designated participant; the
     * neighbourhood is this plot's rendering of it, never extra channel content.
     */
    draw: (ctx, scene, _frame, { hover, cursor }) => {
      const { nodes: marked, pair } = designated(scene, hover, cursor.participants)
      if (marked.size === 0) return
      const { nodes, links } = scene
      const r = scene.nodeRadius + 3

      // `&&` for a pair (that one edge), `||` for a participant (all of its edges) —
      // the same operator distinction the matrix highlight draws. Both endpoints of
      // a drawn edge carry a ring (designated or neighbour), so the stroke stops at
      // the ring's outer rim instead of running under the mark to the centre.
      const rim = r + 0.5
      ctx.save()
      ctx.strokeStyle = CROSSHAIR_COLOR
      for (const link of links) {
        const a = marked.has(link.source)
        const b = marked.has(link.target)
        if (pair ? !(a && b) : !(a || b)) continue
        const s = nodes[link.source]
        const t = nodes[link.target]
        if (!s || !t) continue
        ctx.lineWidth = linkWidth(scene.threshold, link.value)
        strokeTrimmedLink(ctx, s, t, rim, rim)
      }
      ctx.restore()

      // A pair designates the relation, not a neighbourhood: no second tier, or the
      // two endpoints would be buried among their other neighbours.
      if (!pair) {
        for (const index of neighboursOf(scene.data, marked)) {
          const node = nodes[index]
          if (node) strokeCrosshairRing(ctx, node.x, node.y, r)
        }
      }
      for (const index of marked) {
        const node = nodes[index]
        if (node) markCrosshairNode(ctx, node.x, node.y, r)
      }
    },
  },

  hit: (scene, mx, my): FrameHit<ScangraphHover> | null => {
    // Nodes win: an endpoint is a participant, not the pair it happens to sit on.
    const node = findNodeAt(scene, mx, my)
    if (node) {
      const connectionItems = getConnectionItems(scene.data, node.id)
      const content: FrameHit['content'] = [{ key: 'Participant', value: node.label }]
      if (connectionItems.length > 0) {
        content.push({ key: 'Connections', value: connectionItems[0].value })
        for (let i = 1; i < connectionItems.length; i++) content.push(connectionItems[i])
      }
      // The click is otherwise undiscoverable: say what it will do. (Export
      // never hit-tests, so the hint is screen-only by construction.)
      content.push({
        key: '',
        value: scene.highlightSet.has(node.id) ? 'Click to remove highlight' : 'Click to highlight',
      })
      return {
        content,
        anchorX: node.x + 10,
        anchorY: node.y,
        offset: { x: 10, y: 0 },
        tooltipWidth: 160,
        // A click toggles the node's highlight: show that it is clickable.
        cursor: 'pointer',
        data: { kind: 'node', node },
      }
    }

    // The pair itself: the one place this plot states a similarity VALUE.
    const link = findEdgeAt(scene, mx, my)
    if (!link) return EMPTY_HIT
    const s = scene.nodes[link.source]
    const t = scene.nodes[link.target]
    return {
      content: [
        { key: 'Participants', value: `${clipLabel(s.label)} ↔ ${clipLabel(t.label)}` },
        { key: 'Similarity', value: link.value.toFixed(3) },
      ],
      anchorX: (s.x + t.x) / 2,
      anchorY: (s.y + t.y) / 2,
      offset: { x: 10, y: 0 },
      tooltipWidth: 160,
      data: { kind: 'edge', source: link.source, target: link.target, value: link.value },
    }
  },

  // Live reads of the hovered INDICES, like every other publisher: an undo under
  // a resting pointer re-derives who they are, or reads back empty. An edge
  // publishes a sorted PAIR, the same set a similarity-matrix cell publishes.
  hover: (hover, act) => {
    const at = () => {
      const ids = act.input().participantIds
      if (hover === null) return []
      if (hover.kind === 'node') return ids.slice(hover.node.id, hover.node.id + 1)
      return [ids[hover.source], ids[hover.target]]
        .filter((id): id is number => id !== undefined)
        .sort((x, y) => x - y)
    }
    act.publish(at().length === 0 ? null : { participants: at })
  },

  // Only a node toggles the PERSISTED highlight (a deliberate choice, distinct
  // from the transient cursor); a pair has nothing to persist. Stored by
  // participant id, so the emphasis follows the participant, not the index.
  click: (hover, act) => {
    if (hover?.kind !== 'node') return
    const pid = act.input().participantIds[hover.node.id]
    if (pid !== undefined) act.toggle('highlightedParticipants', pid)
  },
})

/**
 * What is designated RIGHT NOW, and whether the designation is a PAIR. One
 * rule for all three sources — this plot's node hover, this plot's edge
 * hover, or the cursor — and the marks read only this, never which source
 * filled it. That is what makes p1 look identical hovered here and hovered in
 * a scarf.
 *
 * `pair` is what an edge hover means: the relation itself, so the marks stay on
 * the two endpoints and their one shared edge. A node hover instead asks "who is
 * like this participant", so it fans out to the whole neighbourhood.
 */
function designated(
  scene: ScangraphScene,
  hovered: ScangraphHover | null,
  cursorParticipants: readonly number[]
): { nodes: Set<number>; pair: boolean } {
  if (hovered?.kind === 'edge') {
    return { nodes: new Set([hovered.source, hovered.target]), pair: true }
  }
  if (hovered?.kind === 'node') {
    return { nodes: new Set([hovered.node.id]), pair: false }
  }
  return { nodes: new Set(cursorRows(scene.participantIds, cursorParticipants)), pair: false }
}

function findNodeAt(scene: ScangraphScene, mx: number, my: number): NodePosition | null {
  const hitR = scene.nodeRadius + 4
  const hitR2 = hitR * hitR
  for (const node of scene.nodes) {
    const dx = mx - node.x
    const dy = my - node.y
    if (dx * dx + dy * dy <= hitR2) return node
  }
  return null
}

/**
 * The nearest link under the pointer, or null. Tolerance is measured from the
 * stroke's EDGE, so a thick (highly similar) link is as easy to hit as it looks.
 * Nodes are tested first by the caller, so an endpoint never resolves to a link.
 */
function findEdgeAt(scene: ScangraphScene, mx: number, my: number) {
  const { nodes, links } = scene
  let best: (typeof links)[number] | null = null
  let bestSlack = EDGE_HIT_TOLERANCE
  for (const link of links) {
    const s = nodes[link.source]
    const t = nodes[link.target]
    if (!s || !t) continue
    const slack =
      distanceToSegment(mx, my, s.x, s.y, t.x, t.y) - linkWidth(scene.threshold, link.value) / 2
    if (slack < bestSlack) {
      bestSlack = slack
      best = link
    }
  }
  return best
}
