import { throttleByRaf } from '$lib/shared/throttle'
import { createDragCursor } from './dragCursor'
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

export function moveHandleAction(
  node: HTMLElement,
  initialParams: MoveHandleActionParams
) {
  let params = initialParams
  let moving = false

  // Body only: the frame's own `cursor: move` stays on while it is dragged.
  const setMoveCursor = createDragCursor()

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updateMove(point)
  })

  function buildOptions() {
    return {
      enabled: params.enabled,
      shouldStart: params.shouldStart,
      // Arm, don't start: under the session's drag threshold the press is a
      // click that selects, and no move session is opened to undo. The
      // session hands the ORIGINAL press point to onStart, so the grab keeps
      // its offset, and it calls neither onEnd nor onCancel for a press that
      // never travelled.
      deferStart: () => true,
      preventDefaultOnMove: true,
      onStart(point: InteractionPoint) {
        moving = true
        setMoveCursor('grabbing')
        params.interaction.beginMove(params.items, point)
      },
      onMove(point: InteractionPoint) {
        move(point)
      },
      onEnd(point: InteractionPoint | null) {
        if (point) {
          params.interaction.updateMove(point)
        }
        // After a cancel the session is idle and this returns null.
        const commit = params.interaction.finishMove()
        moving = false
        setMoveCursor('')
        if (commit) {
          params.onCommit(commit)
        }
      },
      onCancel() {
        moving = false
        setMoveCursor('')
        params.interaction.cancel()
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
      if (moving) {
        setMoveCursor('')
      }
      session.destroy()
    },
  }
}
