import { throttleByRaf } from '$lib/shared/throttle'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type { InteractionPoint } from './model'

type PanSurfaceActionParams = {
  enabled: boolean
  interaction: GridInteractionController
  workspaceContainer?: HTMLElement | null
  /**
   * Optional pointerdown gate. Return false to skip this pointerdown so the
   * target keeps its own semantics. The action is attached to the whole
   * scroll container (so panning works from the padding band and any blank
   * area past the grid content, not just the content box); this carves out
   * grid items and interactive overlays that own their own pointer gestures.
   */
  shouldStart?: (event: PointerEvent) => boolean
}

// Cooperative gestures: a single finger scrolls the page, so touch never
// starts a drag-pan here (two-finger pan and pinch are the frame's own).
const touchAction = 'pan-x pan-y'


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
      shouldStart: (event: PointerEvent) =>
        event.pointerType !== 'touch' &&
        (params.shouldStart?.(event) ?? true),
      touchAction,
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
