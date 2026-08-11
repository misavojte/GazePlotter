import { type DataType } from '$lib/data/types'
import { type CsvFormatOptions } from './encoders/csv'
import { type ExportNaming } from './types'
import { reportProgress, type ExportProgress } from './progress'
import {
  generateUnifiedCsv,
  generateMetadataForBatchCsv,
} from './mappers/segments'
import {
  generateEventUnifiedCsv,
  generateEventBatchCsv,
} from './mappers/events'
import { Archiver } from './encoders/zip'
import { triggerDownload } from './download'
import { generateScanGraph } from './mappers/scangraph'
import { generateWorkspaceJson } from './mappers/workspace'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { AllGridTypes } from '$lib/workspace'
import type { FileMetadataType } from '$lib/data/ingest/types'

/**
 * Downloads a unified CSV of all gaze segments.
 */
export async function downloadUnifiedCsv(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  filterCategoryIds?: Set<number> | boolean,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<void> {
  await reportProgress(onProgress, 0, 100, 'Preparing data...')
  const csv = generateUnifiedCsv(
    data,
    stimulusIds,
    participantIds,
    filterCategoryIds,
    options,
    naming
  )
  await reportProgress(onProgress, 100, 100, 'Downloading...')
  triggerDownload(csv, fileName, '.csv')
}

/**
 * Helper to package a batch of generated CSVs into a zip file with progress yielding.
 */
async function archiveBatch(
  batch: Array<{ fileName: string; content: string }>,
  zipFileName: string,
  onProgress?: ExportProgress
): Promise<Blob> {
  const archiver = new Archiver()
  const total = batch.length
  let count = 0

  for (const item of batch) {
    count++
    await reportProgress(onProgress, count, total, `Packaging ${item.fileName}`)
    archiver.addFile(`${item.fileName}_${zipFileName}.csv`, item.content)
  }

  await reportProgress(onProgress, total, total, 'Generating ZIP archive...')

  return archiver.generateBlob()
}

/**
 * Downloads a ZIP containing individual CSVs for each participant/stimulus.
 */
export async function downloadBatchZip(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  filterCategoryIds?: Set<number> | boolean,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<void> {
  await reportProgress(onProgress, 0, 100, 'Generating individual CSV files...')
  const batch = generateMetadataForBatchCsv(
    data,
    stimulusIds,
    participantIds,
    filterCategoryIds,
    options,
    naming
  )
  const blob = await archiveBatch(batch, fileName, onProgress)
  triggerDownload(blob, fileName, '.zip')
}

/**
 * Downloads a unified CSV of all event occurrences.
 */
export async function downloadEventUnifiedCsv(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<void> {
  await reportProgress(onProgress, 0, 100, 'Preparing event data...')
  const csv = generateEventUnifiedCsv(data, stimulusIds, participantIds, options, naming)
  await reportProgress(onProgress, 100, 100, 'Downloading...')
  triggerDownload(csv, fileName, '.csv')
}

/**
 * Downloads a ZIP of per-participant/stimulus event CSVs.
 */
export async function downloadEventBatchZip(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<void> {
  await reportProgress(onProgress, 0, 100, 'Generating individual event CSV files...')
  const batch = generateEventBatchCsv(data, stimulusIds, participantIds, options, naming)
  const blob = await archiveBatch(batch, fileName, onProgress)
  triggerDownload(blob, fileName, '.zip')
}

/**
 * Downloads a ScanGraph TXT file for a specific stimulus.
 */
export async function downloadScanGraph(
  engine: DataEngine,
  stimulusId: number,
  fileName: string,
  collapsed: boolean
): Promise<void> {
  const content = generateScanGraph(engine, stimulusId, collapsed)
  triggerDownload(content, fileName, '.txt')
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
