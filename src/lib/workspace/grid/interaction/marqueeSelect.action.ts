import { throttleByRaf } from '$lib/shared/throttle'
import { createDragCursor } from './dragCursor'
import { createPointerSession } from './pointerSession'
import type { GridInteractionController } from './controller.svelte'
import type { InteractionPoint, MarqueeBounds } from './model'

type MarqueeSelectActionParams = {
  enabled: boolean
  interaction: GridInteractionController
  /** Presses that draw a rectangle; every other press keeps its own gesture. */
  shouldStart: (event: PointerEvent) => boolean
  /** The drag begins. Fires once the press has travelled into a drag. */
  onStart?: () => void
  /** The rectangle changed, including the last one before it is let go. */
  onChange: (bounds: MarqueeBounds) => void
}

// The value the pan surface declares, repeated rather than defaulted: both
// sessions bind to the frame, and the second to bind sets this property last.
const touchAction = 'pan-x pan-y'

export function marqueeSelectAction(
  node: HTMLElement,
  initialParams: MarqueeSelectActionParams
) {
  let params = initialParams

  const setMarqueeCursor = createDragCursor(node)

  const publish = () => {
    const bounds = params.interaction.marqueeBounds
    if (bounds) params.onChange(bounds)
  }

  const move = throttleByRaf((point: InteractionPoint) => {
    params.interaction.updateMarquee(point)
    publish()
  })

  function createSessionOptions() {
    return {
      enabled: params.enabled,
      shouldStart: (event: PointerEvent) => params.shouldStart(event),
      // Arm, don't start: a modifier-click on the desk keeps its own meaning
      // until the press travels past the drag threshold.
      deferStart: () => true,
      touchAction,
      onStart(point: InteractionPoint) {
        setMarqueeCursor('crosshair')
        params.onStart?.()
        params.interaction.beginMarquee(point)
      },
      onMove(point: InteractionPoint) {
        move(point)
      },
      onEnd(point: InteractionPoint | null) {
        // The last sliver of the drag, which the frame throttle may not have
        // published yet, lands before the session closes.
        if (point) {
          params.interaction.updateMarquee(point)
          publish()
        }
        setMarqueeCursor('')
        params.interaction.finishMarquee()
      },
      onCancel() {
        setMarqueeCursor('')
        params.interaction.finishMarquee()
      },
    }
  }

  const session = createPointerSession(node, createSessionOptions())

  return {
    update(nextParams: MarqueeSelectActionParams) {
      params = nextParams
      session.update(createSessionOptions())
    },
    destroy() {
      setMarqueeCursor('')
      session.destroy()
    },
  }
}
