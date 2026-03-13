import { throttleByRaf } from '$lib/shared/utils/throttle'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type { GridInteractionRect, InteractionPoint } from './model'

type ResizeHandleActionParams = {
  enabled: boolean
  item: GridInteractionRect
  min: { w: number; h: number }
  interaction: GridInteractionController
  onCommit: (rect: GridInteractionRect) => void
}

export function resizeHandleAction(
  node: HTMLElement,
  initialParams: ResizeHandleActionParams
) {
  let params = initialParams

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updateResize(point)
  })

  const session = createPointerSession(node, {
    enabled: params.enabled,
    preventDefaultOnStart: true,
    preventDefaultOnMove: true,
    stopPropagationOnStart: true,
    onStart(point) {
      document.body.style.cursor = 'se-resize'
      params.interaction.beginResize(params.item, params.min, point)
    },
    onMove(point) {
      move(point)
    },
    onEnd(point) {
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

  return {
    update(nextParams: ResizeHandleActionParams) {
      params = nextParams
      session.update({
        enabled: params.enabled,
        preventDefaultOnStart: true,
        preventDefaultOnMove: true,
        stopPropagationOnStart: true,
        onStart(point) {
          document.body.style.cursor = 'se-resize'
          params.interaction.beginResize(params.item, params.min, point)
        },
        onMove(point) {
          move(point)
        },
        onEnd(point) {
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
    },
    destroy() {
      document.body.style.cursor = ''
      session.destroy()
    },
  }
}
