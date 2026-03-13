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

  const session = createPointerSession(node, {
    enabled: params.enabled,
    preventDefaultOnStart: true,
    shouldStart(event) {
      const target = event.target as HTMLElement | null
      if (!target) return false
      return !target.closest('[data-grid-block-pan]')
    },
    onStart(point) {
      setPanCursor('grabbing')
      params.interaction.beginPan(point)
    },
    onMove(point) {
      move(point)
    },
    onEnd(point) {
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
  })

  return {
    update(nextParams: PanSurfaceActionParams) {
      params = nextParams
      session.update({
        enabled: params.enabled,
        preventDefaultOnStart: true,
        shouldStart(event) {
          const target = event.target as HTMLElement | null
          if (!target) return false
          return !target.closest('[data-grid-block-pan]')
        },
        onStart(point) {
          setPanCursor('grabbing')
          params.interaction.beginPan(point)
        },
        onMove(point) {
          move(point)
        },
        onEnd(point) {
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
      })
    },
    destroy() {
      setPanCursor('')
      session.destroy()
    },
  }
}
