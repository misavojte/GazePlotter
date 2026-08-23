import { sessionScoped } from '$lib/session/context'
import { estimateTextWidth } from '$lib/shared/textMeasure'
import {
  TOOLTIP_JUMP_THRESHOLD,
  TOOLTIP_DEBOUNCE_DELAY,
  WIDTH_ESTIMATION,
} from './const'

export interface TooltipStateType {
  content: Array<{ key: string; value: string }>
  x: number
  y: number
  width?: number
}

/** Stored tooltip: the payload plus the identity `update` assigns. The id
    drives the keyed render (slide between same-id positions, fade across
    different ids); it is owned here and nowhere else. */
export type CurrentTooltip = TooltipStateType & { id: string }

const newTooltipId = () => Math.random().toString(36).substring(2, 9)

/**
 * Estimates the width of the tooltip based on its content.
 */
export const estimateTooltipWidth = (
  content: Array<{ key: string; value: string }>
): number => {
  if (content.length === 0) return 0
  const longestValue = content.reduce(
    (max, item) => (item.value.length > max.length ? item.value : max),
    ''
  )
  return Math.min(
    WIDTH_ESTIMATION.MAX_WIDTH,
    estimateTextWidth(longestValue, WIDTH_ESTIMATION.FONT_SIZE) +
      WIDTH_ESTIMATION.PADDING
  )
}

/** Per-session tooltip (`useTooltip`); the debounce timer lives with it. */
export class TooltipState {
  current = $state<CurrentTooltip | null>(null)
  private timer: ReturnType<typeof setTimeout> | null = null

  /** Update with debounce to prevent flickering; `null` hides. */
  update(
    value: TooltipStateType | null,
    delay: number = TOOLTIP_DEBOUNCE_DELAY
  ): void {
    if (this.timer !== null) clearTimeout(this.timer)

    let next: CurrentTooltip | null = null
    if (value) {
      // Conserve identity only for small jumps: smooth slides for nearby
      // elements, fade out/in for far ones.
      let id = newTooltipId()
      if (this.current) {
        const dx = value.x - this.current.x
        const dy = value.y - this.current.y
        if (Math.sqrt(dx * dx + dy * dy) < TOOLTIP_JUMP_THRESHOLD) {
          id = this.current.id
        }
      }
      next = {
        ...value,
        id,
        width: value.width ?? estimateTooltipWidth(value.content),
      }
    }

    this.timer = setTimeout(() => {
      this.current = next
      this.timer = null
    }, delay)
  }
}

/** This session's tooltip; resolve at component init. */
export const useTooltip = sessionScoped(() => new TooltipState())
