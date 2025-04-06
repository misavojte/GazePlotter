import { writable } from 'svelte/store'

export interface TooltipStoreType {
  visible: boolean
  // object with string keys and string values
  content: Array<{ key: string; value: string }>
  x: number
  y: number
  width: number
}

export const tooltipStore = writable<TooltipStoreType | null>(null)

// Debounce timer reference
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Update the tooltip with debounce to prevent flickering
 * @param value The tooltip data or null to hide
 * @param delay Debounce delay in ms (default: 150ms)
 */
export const updateTooltip = (
  value: TooltipStoreType | null,
  delay: number = 150
) => {
  // Clear any existing timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }

  // Set a new timer
  debounceTimer = setTimeout(() => {
    tooltipStore.set(value)
    debounceTimer = null
  }, delay)
}
