import {
  type DataType,
  type JsonImportOldFormat,
  CURRENT_SCHEMA_VERSION,
} from '$lib/data/types'
import { binarySegmentsToJsonWithSpatial, type StoredSegments } from '$lib/data/binary'
import type { FileMetadataType } from '$lib/data/ingest/types'
import { encodeJson, wrapProjectPayload } from '../encoders/json'

/**
 * Maps the application state (data + layout) into a Project manifest.
 * `storedSegments`: segments become a {@link StoredSegments} marker (the
 * caller writes {@link segmentEntries}) and the JSON is compact; otherwise
 * the legacy nested arrays, pretty-printed.
 */
export function generateWorkspaceJson(
  data: DataType,
  gridItems: any[],
  fileMetadata: FileMetadataType | null,
  { storedSegments = false }: { storedSegments?: boolean } = {}
): string {
  const { maxParticipants, stimuliCount, hasSpatialData } = data.segments
  let exportData: object
  if (storedSegments) {
    const marker: StoredSegments = { stored: 'entries', maxParticipants, stimuliCount, hasSpatialData }
    exportData = { ...data, segments: marker }
  } else {
    const { segments, spatialData } = binarySegmentsToJsonWithSpatial(data.segments)
    exportData = { ...data, segments, ...(spatialData ? { spatialData } : {}) } satisfies JsonImportOldFormat
  }

  // The stamped version is sourced from the same constant the migration
  // ceiling uses, so the stamp matches the shape of `exportData`.
  const payload = wrapProjectPayload(
    { data: exportData, gridItems, fileMetadata },
    CURRENT_SCHEMA_VERSION
  )
  return encodeJson(payload, !storedSegments)
}
