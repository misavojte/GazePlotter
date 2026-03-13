import { throttleByRaf } from '$lib/shared/utils/throttle'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type { GridInteractionRect, InteractionPoint } from './model'

export type MoveHandleActionParams = {
  enabled: boolean
  item: GridInteractionRect
  interaction: GridInteractionController
  onCommit: (rect: GridInteractionRect) => void
}

export function moveHandleAction(
  node: HTMLElement,
  initialParams: MoveHandleActionParams
) {
  let params = initialParams

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updateMove(point)
  })

  const session = createPointerSession(node, {
    enabled: params.enabled,
    preventDefaultOnStart: true,
    preventDefaultOnMove: true,
    stopPropagationOnStart: true,
    onStart(point) {
      document.body.style.cursor = 'grabbing'
      params.interaction.beginMove(params.item, point)
    },
    onMove(point) {
      move(point)
    },
    onEnd(point) {
      if (point) {
        params.interaction.updateMove(point)
      }
      const commit = params.interaction.finishMove()
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
    update(nextParams: MoveHandleActionParams) {
      params = nextParams
      session.update({
        enabled: params.enabled,
        preventDefaultOnStart: true,
        preventDefaultOnMove: true,
        stopPropagationOnStart: true,
        onStart(point) {
          document.body.style.cursor = 'grabbing'
          params.interaction.beginMove(params.item, point)
        },
        onMove(point) {
          move(point)
        },
        onEnd(point) {
          if (point) {
            params.interaction.updateMove(point)
          }
          const commit = params.interaction.finishMove()
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
