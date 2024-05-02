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
