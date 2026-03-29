import { type DataType } from '$lib/data/types'

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
