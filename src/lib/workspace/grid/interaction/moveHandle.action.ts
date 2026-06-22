import { throttleByRaf } from '$lib/shared/utils/throttle'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type { GridInteractionRect, InteractionPoint } from './model'

export type MoveHandleActionParams = {
  enabled: boolean
  /**
   * The item(s) to move. A single-item drag passes one rect; when the grabbed
   * item is part of a multi-selection, all selected rects are passed so they
   * move together as a group.
   */
  items: GridInteractionRect[]
  interaction: GridInteractionController
  onCommit: (rects: GridInteractionRect[]) => void
  /**
   * Optional pointerdown gate. Return false to skip this pointerdown —
   * e.g. when the target sits inside a `[data-block-select]` region or
   * an interactive element and should keep its own semantics. When the
   * same action is attached to a large surface like `.grid-item-frame`,
   * this is how we carve out the plot canvas/buttons/inputs.
   */
  shouldStart?: (event: PointerEvent) => boolean
}

// How far the pointer must travel before we commit to a move. Under this
// threshold we treat the gesture as a click and never touch the
// interaction controller — avoiding both the transient "ghosted" flicker
// and a no-op onCommit that would pollute undo history.
const DRAG_START_THRESHOLD_PX = 3

export function moveHandleAction(
  node: HTMLElement,
  initialParams: MoveHandleActionParams
) {
  let params = initialParams
  let pendingDownPoint: InteractionPoint | null = null
  let moveActive = false

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updateMove(point)
  })

  function ensureStarted(point: InteractionPoint): boolean {
    if (moveActive) return true
    if (!pendingDownPoint) return false
    const dx = point.x - pendingDownPoint.x
    const dy = point.y - pendingDownPoint.y
    if (
      dx * dx + dy * dy <
      DRAG_START_THRESHOLD_PX * DRAG_START_THRESHOLD_PX
    ) {
      return false
    }
    document.body.style.cursor = 'grabbing'
    params.interaction.beginMove(params.items, pendingDownPoint)
    moveActive = true
    return true
  }

  function buildOptions() {
    return {
      enabled: params.enabled,
      shouldStart: params.shouldStart,
      preventDefaultOnStart: true,
      preventDefaultOnMove: true,
      stopPropagationOnStart: true,
      onStart(point: InteractionPoint) {
        pendingDownPoint = point
        moveActive = false
      },
      onMove(point: InteractionPoint) {
        if (!ensureStarted(point)) return
        move(point)
      },
      onEnd(point: InteractionPoint | null) {
        const started = moveActive
        pendingDownPoint = null
        if (!started) return
        if (point) {
          params.interaction.updateMove(point)
        }
        const commit = params.interaction.finishMove()
        document.body.style.cursor = ''
        moveActive = false
        if (commit) {
          params.onCommit(commit)
        }
      },
      onCancel() {
        const started = moveActive
        pendingDownPoint = null
        if (!started) return
        document.body.style.cursor = ''
        params.interaction.cancel()
        moveActive = false
      },
    }
  }

  const session = createPointerSession(node, buildOptions())

  return {
    update(nextParams: MoveHandleActionParams) {
      params = nextParams
      session.update(buildOptions())
    },
    destroy() {
      if (moveActive) {
        document.body.style.cursor = ''
      }
      session.destroy()
    },
  }
}
