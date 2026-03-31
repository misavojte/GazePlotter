import { type DataType, type JsonImportOldFormat } from '$lib/data/types'
import { binarySegmentsToJsonWithSpatial } from '$lib/data/binary'
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
  // 1. Prepare domain data (convert binary to legacy JSON for compatibility if needed)
  const { segments, spatialData } = binarySegmentsToJsonWithSpatial(
    data.segments
  )

  const exportData: JsonImportOldFormat = {
    ...data,
    segments,
    ...(spatialData !== undefined ? { spatialData } : {}),
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
