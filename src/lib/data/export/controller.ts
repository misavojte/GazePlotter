import { type DataType } from '$lib/data/types'
import { type CsvFormatOptions } from './encoders/csv'
import {
  generateUnifiedCsv,
  generateMetadataForBatchCsv,
} from './mappers/segments'
import { Archiver } from './encoders/zip'
import { triggerDownload } from './download'
import { generateScanGraph } from './mappers/scangraph'
import { generateWorkplaceJson } from './mappers/workplace'
import { engine } from '$lib/data/engine'
import { fileState } from '$lib/file.state.svelte'
import { grid } from '$lib/workspace/grid'

/**
 * Downloads a unified CSV of all gaze segments.
 */
export function downloadUnifiedCsv(
  data: DataType,
  fileName: string,
  options?: CsvFormatOptions
): void {
  const csv = generateUnifiedCsv(data, options)
  triggerDownload(csv, fileName, '.csv')
}

/**
 * Downloads a ZIP containing individual CSVs for each participant/stimulus.
 */
export async function downloadBatchZip(
  data: DataType,
  fileName: string,
  filterFixations: boolean = false,
  options?: CsvFormatOptions
): Promise<void> {
  const batch = generateMetadataForBatchCsv(data, filterFixations, options)
  const archiver = new Archiver()

  for (const item of batch) {
    archiver.addFile(`${item.fileName}_${fileName}.csv`, item.content)
  }

  const blob = await archiver.generateBlob()
  triggerDownload(blob, fileName, '.zip')
}

/**
 * Downloads a ScanGraph TXT file for a specific stimulus.
 */
export async function downloadScanGraph(
  stimulusId: number,
  fileName: string
): Promise<void> {
  const meta = engine.metadata
  const reader = engine.getReader()
  if (!meta || !reader) return

  const content = await generateScanGraph(meta, reader, stimulusId)
  triggerDownload(content, fileName, '.txt')
}

/**
 * High-level action to download the entire workspace state as JSON.
 */
export function downloadWorkplace(data: DataType, fileName: string): void {
  const json = generateWorkplaceJson(data, grid.items, fileState.metadata)
  triggerDownload(json, fileName, '.json')
}
