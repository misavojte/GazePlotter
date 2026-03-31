import { type DataType, type JsonImportOldFormat } from '$lib/data/types'
import { binarySegmentsToJson } from '$lib/data/binary'
import type { FileMetadataType } from '$lib/data/ingest'
import { encodeJson, wrapProjectPayload } from '../encoders/json'

/**
 * Maps the application state (data + layout) into a Project manifest.
 * It uses the JSON helper to serialize the final object.
 */
export function generateWorkspaceJson(
  data: DataType,
  gridItems: any[],
  fileMetadata: FileMetadataType | null
): string {
  // 1. Prepare domain data (convert binary to legacy JSON for compatibility)
  // Phase 1 note: spatial segment coordinates are intentionally not serialized
  // into workspace JSON yet. They are currently preserved only in live/session data.
  const segments = binarySegmentsToJson(data.segments)

  const exportData: JsonImportOldFormat = {
    ...data,
    segments,
  }

  // 2. Wrap into project schema
  const payload = wrapProjectPayload(
    {
      data: exportData,
      gridItems,
      fileMetadata,
    },
    4
  )

  // 3. Encode to JSON string
  return encodeJson(payload)
}
