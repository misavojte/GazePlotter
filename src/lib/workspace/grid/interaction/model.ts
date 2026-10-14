import {
  gridToPixelDimensions,
  gridToPixelPosition,
  type PixelBounds,
} from '../pixels'
import type { GridConfig, GridItemPosition } from '../types'

export type InteractionPoint = {
  x: number
  y: number
}

export type ScrollOffset = {
  x: number
  y: number
}

/** What the interaction layer moves and resizes: one item's placement. */
export type GridInteractionRect = GridItemPosition

export type IdleSession = {
  kind: 'idle'
}

export type PanSession = {
  kind: 'panning'
  pointerStart: InteractionPoint
  pointerCurrent: InteractionPoint
  scrollStart: ScrollOffset
}

type MoveMember = {
  id: number
  origin: GridInteractionRect
  preview: GridInteractionRect
}

// A move targets one OR many items dragged together by a shared, clamped
// delta. A single-item move is simply a group of one — same code path.
export type MoveSession = {
  kind: 'moving'
  members: MoveMember[]
  pointerStart: InteractionPoint
  pointerCurrent: InteractionPoint
  scrollStart: ScrollOffset
}

type TransformSessionBase = {
  itemId: number
  origin: GridInteractionRect
  preview: GridInteractionRect
  pointerStart: InteractionPoint
  pointerCurrent: InteractionPoint
  scrollStart: ScrollOffset
  min: { w: number; h: number }
}

export type ResizeDirection = 'tl' | 'tr' | 'bl' | 'br'

export type ResizeSession = TransformSessionBase & {
  kind: 'resizing'
  direction: ResizeDirection
}

export type MarqueeBounds = PixelBounds

/**
 * A selection rectangle dragged across the desk. Both corners are kept in
 * GRID space, so the rectangle stays over the plots it was drawn around
 * whatever the camera does mid-drag.
 */
export type MarqueeSession = {
  kind: 'selecting'
  originGrid: InteractionPoint
  currentGrid: InteractionPoint
}

export type GridInteractionSession =
  | IdleSession
  | PanSession
  | MoveSession
  | ResizeSession
  | MarqueeSession

export type GridInteractionMode = GridInteractionSession['kind']

export function createIdleSession(): IdleSession {
  return { kind: 'idle' }
}

export function startPanSession(
  point: InteractionPoint,
  scroll: ScrollOffset
): PanSession {
  return {
    kind: 'panning',
    pointerStart: point,
    pointerCurrent: point,
    scrollStart: scroll,
  }
}

export function updatePanSession(
  session: PanSession,
  point: InteractionPoint
): PanSession {
  return {
    ...session,
    pointerCurrent: point,
  }
}

export function startMoveSession(
  rects: GridInteractionRect[],
  point: InteractionPoint,
  scroll: ScrollOffset
): MoveSession {
  return {
    kind: 'moving',
    members: rects.map(rect => ({
      id: rect.id,
      origin: { ...rect },
      preview: { ...rect },
    })),
    pointerStart: point,
    pointerCurrent: point,
    scrollStart: scroll,
  }
}

export function startResizeSession(
  rect: GridInteractionRect,
  min: { w: number; h: number },
  point: InteractionPoint,
  scroll: ScrollOffset,
  direction: ResizeDirection = 'br'
): ResizeSession {
  return {
    kind: 'resizing',
    itemId: rect.id,
    origin: { ...rect },
    preview: { ...rect },
    pointerStart: point,
    pointerCurrent: point,
    scrollStart: scroll,
    min,
    direction,
  }
}

export function startMarqueeSession(
  gridPoint: InteractionPoint
): MarqueeSession {
  return { kind: 'selecting', originGrid: gridPoint, currentGrid: gridPoint }
}

export function updateMarqueeSession(
  session: MarqueeSession,
  gridPoint: InteractionPoint
): MarqueeSession {
  return { ...session, currentGrid: gridPoint }
}

/** The rectangle the two corners span, in grid px, however it was dragged. */
export function marqueeBoundsOf(session: MarqueeSession): MarqueeBounds {
  const { originGrid, currentGrid } = session
  return {
    left: Math.min(originGrid.x, currentGrid.x),
    top: Math.min(originGrid.y, currentGrid.y),
    right: Math.max(originGrid.x, currentGrid.x),
    bottom: Math.max(originGrid.y, currentGrid.y),
  }
}

/** Items the rectangle touches: any overlap counts, as on a design canvas. */
export function itemIdsTouchedByMarquee(
  positions: GridItemPosition[],
  bounds: MarqueeBounds,
  config: GridConfig
): number[] {
  return positions
    .filter(position => {
      const { left, top } = gridToPixelPosition(position.x, position.y, config)
      const { width, height } = gridToPixelDimensions(
        position.w,
        position.h,
        config
      )
      return (
        left < bounds.right &&
        left + width > bounds.left &&
        top < bounds.bottom &&
        top + height > bounds.top
      )
    })
    .map(position => position.id)
}

export function isTransformSession(
  session: GridInteractionSession
): session is MoveSession | ResizeSession {
  return session.kind === 'moving' || session.kind === 'resizing'
}

/**
 * Converts pointer displacement to grid-cell displacement.
 *
 * @param zoom - Current workspace zoom factor (CSS `transform: scale(zoom)`).
 *   Because the grid is rendered inside a scaled container, 1 px of pointer
 *   movement corresponds to `1 / zoom` px in grid-space. Dividing the raw
 *   delta by `zoom` corrects this mismatch.
 */
function getGridDelta(
  pointerStart: InteractionPoint,
  pointerCurrent: InteractionPoint,
  scrollStart: ScrollOffset,
  scrollCurrent: ScrollOffset,
  config: GridConfig,
  zoom: number = 1
) {
  const deltaX =
    (pointerCurrent.x - pointerStart.x + (scrollCurrent.x - scrollStart.x)) /
    zoom
  const deltaY =
    (pointerCurrent.y - pointerStart.y + (scrollCurrent.y - scrollStart.y)) /
    zoom

  return {
    x: Math.round(deltaX / (config.cellSize.width + config.gap)),
    y: Math.round(deltaY / (config.cellSize.height + config.gap)),
  }
}

export function updateMoveSession(
  session: MoveSession,
  point: InteractionPoint,
  scroll: ScrollOffset,
  config: GridConfig,
  zoom: number = 1
): MoveSession {
  const delta = getGridDelta(
    session.pointerStart,
    point,
    session.scrollStart,
    scroll,
    config,
    zoom
  )

  // No clamp at the origin: a preview may sit above or left of it, and the
  // commit shifts the whole layout back to non-negative cells
  // (`translateLayout`). One shared delta keeps a group's relative layout.
  const dx = delta.x
  const dy = delta.y

  return {
    ...session,
    pointerCurrent: point,
    members: session.members.map(member => ({
      ...member,
      preview: {
        ...member.origin,
        x: member.origin.x + dx,
        y: member.origin.y + dy,
      },
    })),
  }
}

export function updateResizeSession(
  session: ResizeSession,
  point: InteractionPoint,
  scroll: ScrollOffset,
  config: GridConfig,
  zoom: number = 1
): ResizeSession {
  const delta = getGridDelta(
    session.pointerStart,
    point,
    session.scrollStart,
    scroll,
    config,
    zoom
  )

  const { origin, min, direction } = session

  // Left-side corners (tl, bl) invert dx so dragging *right* shrinks w;
  // top-side corners (tl, tr) invert dy so dragging *down* shrinks h.
  const signX = direction === 'tl' || direction === 'bl' ? -1 : 1
  const signY = direction === 'tl' || direction === 'tr' ? -1 : 1

  const newW = Math.max(min.w, origin.w + signX * delta.x)
  const newH = Math.max(min.h, origin.h + signY * delta.y)

  // When the anchor edge is on the right (signX === -1), shrinking w
  // means the left edge slides right by the reduction amount. Mirror
  // for the top edge.
  // May go negative, like a move; the commit normalises it.
  const newX = signX === -1 ? origin.x + (origin.w - newW) : origin.x
  const newY = signY === -1 ? origin.y + (origin.h - newH) : origin.y

  return {
    ...session,
    pointerCurrent: point,
    preview: {
      ...origin,
      x: newX,
      y: newY,
      w: newW,
      h: newH,
    },
  }
}

export function mergePreviewPosition(
  positions: GridItemPosition[],
  previews: GridInteractionRect[]
): GridItemPosition[] {
  if (previews.length === 0) return positions

  const byId = new Map(previews.map(p => [p.id, p]))
  const seen = new Set<number>()
  const next = positions.map(position => {
    const preview = byId.get(position.id)
    if (!preview) return position
    seen.add(preview.id)
    return {
      id: preview.id,
      x: preview.x,
      y: preview.y,
      w: preview.w,
      h: preview.h,
    }
  })

  for (const preview of previews) {
    if (seen.has(preview.id)) continue
    next.push({
      id: preview.id,
      x: preview.x,
      y: preview.y,
      w: preview.w,
      h: preview.h,
    })
  }

  return next
}
