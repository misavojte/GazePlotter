import type { FileInputType, FileMetadataType } from '$lib/workspace/type'

class FileState {
  processing = $state<'processing' | 'done' | 'fail'>('processing')
  metadata = $state<FileMetadataType | null>(null)
  input = $state<FileInputType | null>(null)
}

export const fileState = new FileState()
