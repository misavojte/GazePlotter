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
  /** Presses that pan only once they become a drag (a click stays a click). */
  deferStart?: (event: PointerEvent) => boolean
}

// Cooperative gestures: a single finger scrolls the page, so touch never
// starts a drag-pan here (two-finger pan and pinch are the frame's own).
const touchAction = 'pan-x pan-y'

// Middle button drags pan from anywhere, plots included, like a design canvas.
const MIDDLE_BUTTON = 1


export function panSurfaceAction(
  node: HTMLElement,
  initialParams: PanSurfaceActionParams
) {
  let params = initialParams

  const setPanCursor = (cursor: string) => {
    document.body.style.cursor = cursor
    // A deferred pan never prevented the press, so text selection would follow it.
    document.body.style.userSelect = cursor ? 'none' : ''
    if (cursor) window.getSelection?.()?.removeAllRanges()
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
        (event.button === MIDDLE_BUTTON ||
          (params.shouldStart?.(event) ?? true)),
      deferStart: (event: PointerEvent) =>
        event.button !== MIDDLE_BUTTON && (params.deferStart?.(event) ?? false),
      touchAction,
      mouseButtons: [0, MIDDLE_BUTTON],
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

  // Blocks the browser's middle-click autoscroll, which would fight the pan.
  const onMouseDown = (event: MouseEvent) => {
    if (params.enabled && event.button === MIDDLE_BUTTON) event.preventDefault()
  }
  node.addEventListener('mousedown', onMouseDown)

  const session = createPointerSession(node, createSessionOptions())

  return {
    update(nextParams: PanSurfaceActionParams) {
      params = nextParams
      session.update(createSessionOptions())
    },
    destroy() {
      setPanCursor('')
      node.removeEventListener('mousedown', onMouseDown)
      session.destroy()
    },
  }
}
