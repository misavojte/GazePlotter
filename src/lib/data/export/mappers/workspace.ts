import {
  type DataType,
  type JsonImportOldFormat,
  CURRENT_SCHEMA_VERSION,
} from '$lib/data/types'
import { binarySegmentsToJsonWithSpatial } from '$lib/data/binary'
import type { FileMetadataType } from '$lib/data/ingest/types'
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
  const { segments, spatialData } = binarySegmentsToJsonWithSpatial(
    data.segments
  )

  const exportData: JsonImportOldFormat = {
    ...data,
    segments,
    ...(spatialData ? { spatialData } : {}),
  }

  // 2. Wrap into project schema. The stamped version is sourced from the same
  //    constant the migration ceiling uses, so the stamp matches the shape of
  //    `exportData` rather than a hardcoded (and previously stale) literal.
  const payload = wrapProjectPayload(
    {
      data: exportData,
      gridItems,
      fileMetadata,
    },
    CURRENT_SCHEMA_VERSION
  )

  // 3. Encode to JSON string
  return encodeJson(payload)
}
