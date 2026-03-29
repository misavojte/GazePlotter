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

let _state = $state<TooltipStateType | null>(null)

/**
 * Global accessor for the tooltip state.
 */
export const tooltipState = {
  get current() {
    return _state
  },
  set current(value: TooltipStateType | null) {
    _state = value
  },
}

// Debounce timer reference
let debounceTimer: ReturnType<typeof setTimeout> | null = null

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

/**
 * Update the tooltip with debounce to prevent flickering
 * @param value The tooltip data or null to hide
 * @param delay Debounce delay in ms
 */
export const updateTooltip = (
  value: TooltipStateType | null,
  delay: number = TOOLTIP_DEBOUNCE_DELAY
) => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }

  if (value) {
    // Only conserve identity (ID) if the jump distance is small
    // This allows smooth slides for nearby elements and fade out/in for jumps.
    if (_state && _state.visible) {
      const dx = value.x - _state.x
      const dy = value.y - _state.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance >= TOOLTIP_JUMP_THRESHOLD) {
        // Force a new ID to trigger fade out/in instead of slide
        value.id = Math.random().toString(36).substring(2, 9)
      } else {
        // Conserve ID for smooth slide
        value.id = _state.id
      }
    }

    if (!value.width) {
      value.width = estimateTooltipWidth(value.content)
    }
  }

  debounceTimer = setTimeout(() => {
    _state = value
    debounceTimer = null
  }, delay)
}
