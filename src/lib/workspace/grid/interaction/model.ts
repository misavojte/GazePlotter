import type { GridConfig, GridItemPosition } from '../types'

export type InteractionPoint = {
  x: number
  y: number
}

export type ScrollOffset = {
  x: number
  y: number
}

export type GridInteractionRect = {
  id: number
  x: number
  y: number
  w: number
  h: number
}

export type IdleSession = {
  kind: 'idle'
}

export type PanSession = {
  kind: 'panning'
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

export type MoveSession = TransformSessionBase & {
  kind: 'moving'
}

export type ResizeDirection = 'tl' | 'tr' | 'bl' | 'br'

export type ResizeSession = TransformSessionBase & {
  kind: 'resizing'
  direction: ResizeDirection
}

/**
 * Discriminated commit descriptor for a placement session. The session
 * only tracks a ghost preview rect; the payload tells the commit
 * handler in Grid.svelte which workspace command to dispatch when the
 * user clicks. Kept here (not in the controller) so the commit side can
 * stay a pure switch on `payload.kind`.
 */
export type PlacementPayload =
  | { kind: 'duplicate'; sourceItemId: number }
  | { kind: 'add'; vizType: string }

/**
 * Placement session: a cursor-driven ghost preview used when placing a
 * to-be-created item (new visualization or a duplicate). Unlike a move
 * session this has no existing item to ghost — the item doesn't exist
 * yet. On commit, the grid-coord `preview` is handed off to the
 * workspace command identified by `payload`.
 */
export type PlacingSession = {
  kind: 'placing'
  payload: PlacementPayload
  preview: GridInteractionRect
  pointerCurrent: InteractionPoint
}

export type GridInteractionSession =
  | IdleSession
  | PanSession
  | MoveSession
  | ResizeSession
  | PlacingSession

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
  rect: GridInteractionRect,
  point: InteractionPoint,
  scroll: ScrollOffset
): MoveSession {
  return {
    kind: 'moving',
    itemId: rect.id,
    origin: { ...rect },
    preview: { ...rect },
    pointerStart: point,
    pointerCurrent: point,
    scrollStart: scroll,
    min: { w: rect.w, h: rect.h },
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

export function isTransformSession(
  session: GridInteractionSession
): session is MoveSession | ResizeSession {
  return session.kind === 'moving' || session.kind === 'resizing'
}

export function startPlacingSession(
  payload: PlacementPayload,
  rect: GridInteractionRect,
  point: InteractionPoint
): PlacingSession {
  return {
    kind: 'placing',
    payload,
    preview: { ...rect },
    pointerCurrent: point,
  }
}

export function updatePlacingSession(
  session: PlacingSession,
  gridPoint: { x: number; y: number },
  point: InteractionPoint
): PlacingSession {
  return {
    ...session,
    preview: {
      ...session.preview,
      x: Math.max(0, gridPoint.x),
      y: Math.max(0, gridPoint.y),
    },
    pointerCurrent: point,
  }
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

  return {
    ...session,
    pointerCurrent: point,
    preview: {
      ...session.origin,
      x: Math.max(0, session.origin.x + delta.x),
      y: Math.max(0, session.origin.y + delta.y),
    },
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
  const newX =
    signX === -1 ? Math.max(0, origin.x + (origin.w - newW)) : origin.x
  const newY =
    signY === -1 ? Math.max(0, origin.y + (origin.h - newH)) : origin.y

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
  preview: GridInteractionRect | null
): GridItemPosition[] {
  if (!preview) return positions

  let found = false
  const next = positions.map(position => {
    if (position.id !== preview.id) return position
    found = true
    return {
      id: preview.id,
      x: preview.x,
      y: preview.y,
      w: preview.w,
      h: preview.h,
    }
  })

  if (!found) {
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
