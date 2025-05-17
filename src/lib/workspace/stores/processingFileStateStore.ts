import { writable } from 'svelte/store'

export const processingFileStateStore = writable<
  'processing' | 'done' | 'fail'
>('processing')
