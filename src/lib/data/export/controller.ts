import { type DataType } from '$lib/data/types'
import { type CsvFormatOptions } from './encoders/csv'
import {
  generateUnifiedCsv,
  generateMetadataForBatchCsv,
} from './mappers/segments'
import { Archiver } from './encoders/zip'
import { triggerDownload } from './download'
import { generateScanGraph } from './mappers/scangraph'
import {
  type ScanpathSimilarityExportOptions,
  generateScanpathSimilarityCsv,
} from './mappers/scanpath-similarity'
import { generateWorkspaceJson } from './mappers/workspace'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { AllGridTypes } from '$lib/workspace'
import type { FileMetadataType } from '$lib/data/ingest/types'

/**
 * Downloads a unified CSV of all gaze segments.
 */
export function downloadUnifiedCsv(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  filterFixations: boolean = false,
  options?: CsvFormatOptions
): void {
  const csv = generateUnifiedCsv(data, stimulusIds, filterFixations, options)
  triggerDownload(csv, fileName, '.csv')
}

/**
 * Downloads a ZIP containing individual CSVs for each participant/stimulus.
 */
export async function downloadBatchZip(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  filterFixations: boolean = false,
  options?: CsvFormatOptions
): Promise<void> {
  const batch = generateMetadataForBatchCsv(
    data,
    stimulusIds,
    filterFixations,
    options
  )
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
  engine: DataEngine,
  stimulusId: number,
  fileName: string
): Promise<void> {
  const meta = engine.metadata
  const reader = engine.getReader()
  const aoiGroupReader = engine.getAoiGroupReader()
  if (!meta || !reader || !aoiGroupReader) {
    throw new Error('Data engine not ready for ScanGraph export')
  }

  const content = await generateScanGraph(
    meta,
    reader,
    aoiGroupReader,
    stimulusId
  )
  triggerDownload(content, fileName, '.txt')
}

/**
 * Downloads a Scanpath Similarity matrix as CSV.
 */
export function downloadScanpathSimilarity(
  engine: DataEngine,
  options: ScanpathSimilarityExportOptions
): void {
  const { content } = generateScanpathSimilarityCsv(engine, options)
  triggerDownload(content, options.fileName, '.csv')
}

/**
 * High-level action to download the entire workspace state as JSON.
 */
export function downloadWorkspace(
  data: DataType,
  fileName: string,
  layoutState: AllGridTypes[],
  metadata: FileMetadataType | null
): void {
  const json = generateWorkspaceJson(data, layoutState, metadata)
  triggerDownload(json, fileName, '.json')
}
