import { writable } from 'svelte/store'

export const processingFileStateStore = writable<'idle' | 'processing' | 'done' | 'fail' | 'success'>('idle')
