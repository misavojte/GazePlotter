import { writable } from 'svelte/store'
import type { FileInputType, FileMetadataType } from '$lib/workspace'

export const processingFileStateStore = writable<
  'processing' | 'done' | 'fail'
>('processing')

export const fileMetadataStore = writable<FileMetadataType | null>(null)

export const currentFileInputStore = writable<FileInputType | null>(null)
