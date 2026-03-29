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

export type ResizeSession = TransformSessionBase & {
  kind: 'resizing'
}

export type GridInteractionSession =
  | IdleSession
  | PanSession
  | MoveSession
  | ResizeSession

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
  scroll: ScrollOffset
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
  }
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

  return {
    ...session,
    pointerCurrent: point,
    preview: {
      ...session.origin,
      w: Math.max(session.min.w, session.origin.w + delta.x),
      h: Math.max(session.min.h, session.origin.h + delta.y),
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
