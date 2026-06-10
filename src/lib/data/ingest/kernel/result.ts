import type { DataType } from '$lib/data/types'
import type { GridItemSnapshot } from '$lib/workspace/grid/types'
import type { FileMetadataType, ParseSettings } from '../types'

/**
 * What an ingest job produces — either a freshly parsed dataset, or a
 * restored workspace (dataset + grid layout + original file metadata).
 *
 * The worker posts this envelope verbatim in its 'done' message; the
 * main-thread service applies it (dataset → default grid layout + success
 * metadata; workspace → stored layout + stored metadata).
 */
export type IngestResult =
  | {
      kind: 'dataset'
      data: DataType
      /** Parse settings of the last processed file (provenance display). */
      settings: ParseSettings
    }
  | {
      kind: 'workspace'
      version: number
      data: DataType
      gridItems?: GridItemSnapshot[]
      fileMetadata?: FileMetadataType | null
    }
