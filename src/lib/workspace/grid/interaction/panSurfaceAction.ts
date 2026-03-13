import { throttleByRaf } from '$lib/shared/utils/throttle'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type { InteractionPoint } from './model'

type PanSurfaceActionParams = {
  enabled: boolean
  interaction: GridInteractionController
  workspaceContainer?: HTMLElement | null
}

export function panSurfaceAction(
  node: HTMLElement,
  initialParams: PanSurfaceActionParams
) {
  let params = initialParams

  const setPanCursor = (cursor: string) => {
    document.body.style.cursor = cursor
    node.style.cursor = cursor
    if (params.workspaceContainer) {
      params.workspaceContainer.style.cursor = cursor
    }
  }

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updatePan(point)
  })

  function createSessionOptions() {
    return {
      enabled: params.enabled,
      preventDefaultOnStart: true,
      onStart(point: InteractionPoint) {
        setPanCursor('grabbing')
        params.interaction.beginPan(point)
      },
      onMove(point: InteractionPoint) {
        move(point)
      },
      onEnd(point: InteractionPoint | null) {
        if (point) {
          params.interaction.updatePan(point)
        }
        setPanCursor('')
        params.interaction.endPan()
      },
      onCancel() {
        setPanCursor('')
        params.interaction.endPan()
      },
    }
  }

  const session = createPointerSession(node, createSessionOptions())

  return {
    update(nextParams: PanSurfaceActionParams) {
      params = nextParams
      session.update(createSessionOptions())
    },
    destroy() {
      setPanCursor('')
      session.destroy()
    },
  }
}
