import { sessionScoped } from '$lib/session/context'
import { estimateTextWidth } from '$lib/shared/utils/textUtils'
import {
  TOOLTIP_JUMP_THRESHOLD,
  TOOLTIP_DEBOUNCE_DELAY,
  WIDTH_ESTIMATION,
} from './const'

export interface TooltipStateType {
  id: string
  visible: boolean
  content: Array<{ key: string; value: string }>
  x: number
  y: number
  width?: number
}

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
  current = $state<TooltipStateType | null>(null)
  private timer: ReturnType<typeof setTimeout> | null = null

  /** Update with debounce to prevent flickering; `null` hides. */
  update(
    value: TooltipStateType | null,
    delay: number = TOOLTIP_DEBOUNCE_DELAY
  ): void {
    if (this.timer !== null) clearTimeout(this.timer)

    if (value) {
      // Conserve identity (ID) only for small jumps: smooth slides for nearby
      // elements, fade out/in for far ones.
      if (this.current && this.current.visible) {
        const dx = value.x - this.current.x
        const dy = value.y - this.current.y
        if (Math.sqrt(dx * dx + dy * dy) >= TOOLTIP_JUMP_THRESHOLD) {
          value.id = Math.random().toString(36).substring(2, 9)
        } else {
          value.id = this.current.id
        }
      }
      if (!value.width) value.width = estimateTooltipWidth(value.content)
    }

    this.timer = setTimeout(() => {
      this.current = value
      this.timer = null
    }, delay)
  }
}

/** This session's tooltip; resolve at component init. */
export const useTooltip = sessionScoped(() => new TooltipState())
