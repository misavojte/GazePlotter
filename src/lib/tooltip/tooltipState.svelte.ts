import { estimateTextWidth } from '$lib/shared/utils/textUtils';

export interface TooltipStateType {
  visible: boolean
  content: Array<{ key: string; value: string }>
  x: number
  y: number
  width?: number
}

let _state = $state<TooltipStateType | null>(null);

/**
 * Global accessor for the tooltip state.
 */
export const tooltipState = {
  get current() { return _state },
  set current(value: TooltipStateType | null) { _state = value }
}

// Debounce timer reference
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Update the tooltip with debounce to prevent flickering
 * @param value The tooltip data or null to hide
 * @param delay Debounce delay in ms (default: 150ms)
 */
export const updateTooltip = (
  value: TooltipStateType | null,
  delay: number = 150
) => {
  // Clear any existing timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }

  // if no width is provided, calculate it based on the content
  if (value && !value.width) {
    const content = value.content
    const textLineWithMostCharacters = content.map(item => item.value).sort((a, b) => b.length - a.length)[0]
    value.width = Math.min(175, estimateTextWidth(textLineWithMostCharacters, 12) + 15)
  }

  // Set a new timer
  debounceTimer = setTimeout(() => {
    _state = value
    debounceTimer = null
  }, delay)
}
