import { throttleByRaf } from '$lib/shared/utils/throttle'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type {
  GridInteractionRect,
  InteractionPoint,
  ResizeDirection,
} from './model'

type ResizeHandleActionParams = {
  enabled: boolean
  item: GridInteractionRect
  min: { w: number; h: number }
  interaction: GridInteractionController
  onCommit: (rect: GridInteractionRect) => void
  /** Which corner drives the resize. Defaults to bottom-right for back-compat. */
  direction?: ResizeDirection
}

function cursorFor(direction: ResizeDirection): string {
  // Diagonal resize cursors: tl/br share one axis, tr/bl share the other.
  return direction === 'tl' || direction === 'br' ? 'nwse-resize' : 'nesw-resize'
}

export function resizeHandleAction(
  node: HTMLElement,
  initialParams: ResizeHandleActionParams
) {
  let params = initialParams

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updateResize(point)
  })

  const buildHandlers = () => ({
    enabled: params.enabled,
    preventDefaultOnStart: true,
    preventDefaultOnMove: true,
    stopPropagationOnStart: true,
    onStart(point: InteractionPoint) {
      const direction = params.direction ?? 'br'
      document.body.style.cursor = cursorFor(direction)
      params.interaction.beginResize(params.item, params.min, point, direction)
    },
    onMove(point: InteractionPoint) {
      move(point)
    },
    onEnd(point: InteractionPoint | null) {
      if (point) {
        params.interaction.updateResize(point)
      }
      const commit = params.interaction.finishResize()
      document.body.style.cursor = ''
      if (commit) {
        params.onCommit(commit)
      }
    },
    onCancel() {
      document.body.style.cursor = ''
      params.interaction.cancel()
    },
  })

  const session = createPointerSession(node, buildHandlers())

  return {
    update(nextParams: ResizeHandleActionParams) {
      params = nextParams
      session.update(buildHandlers())
    },
    destroy() {
      document.body.style.cursor = ''
      session.destroy()
    },
  }
}
