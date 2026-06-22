import { type DataType } from '$lib/data/types'

/**
 * Whether exported names reflect the user's display transformations — renames
 * (displayed name), grouping (entities merged by displayed name), and derived
 * interval event channels — or the raw imported data (original names, no
 * grouping, original channels only). 'displayed' is the default everywhere.
 */
export type ExportNaming = 'displayed' | 'raw'

export interface ExportGenerator<T = string | Blob, O = any> {
  generate(data: DataType, options?: O): T | Promise<T>
}

export interface BatchExportItem {
  fileName: string
  content: string | Blob
}

export interface BatchExportGenerator<O = any> {
  generateBatch(
    data: DataType,
    options?: O
  ): BatchExportItem[] | Promise<BatchExportItem[]>
}
