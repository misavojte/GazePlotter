import { writable } from 'svelte/store'
import type { FileMetadataType } from '../type/fileMetadataType'

export const processingFileStateStore = writable<
  'processing' | 'done' | 'fail'
>('processing')

export const fileMetadataStore = writable<FileMetadataType | null>(null)
