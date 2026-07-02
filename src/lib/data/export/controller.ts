import { type DataType } from '$lib/data/types'
import { type CsvFormatOptions } from './encoders/csv'
import { type ExportNaming } from './types'
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
  onProgress?: (position: number, total: number, name: string) => void | Promise<void>
): Promise<void> {
  if (onProgress) {
    await onProgress(0, 100, 'Preparing data...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  const csv = generateUnifiedCsv(
    data,
    stimulusIds,
    participantIds,
    filterCategoryIds,
    options,
    naming
  )
  if (onProgress) {
    await onProgress(100, 100, 'Downloading...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  triggerDownload(csv, fileName, '.csv')
}

/**
 * Helper to package a batch of generated CSVs into a zip file with progress yielding.
 */
async function archiveBatch(
  batch: Array<{ fileName: string; content: string }>,
  zipFileName: string,
  onProgress?: (position: number, total: number, name: string) => void | Promise<void>
): Promise<Blob> {
  const archiver = new Archiver()
  const total = batch.length
  let count = 0

  for (const item of batch) {
    count++
    if (onProgress) {
      await onProgress(count, total, `Packaging ${item.fileName}`)
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    archiver.addFile(`${item.fileName}_${zipFileName}.csv`, item.content)
  }

  if (onProgress) {
    await onProgress(total, total, 'Generating ZIP archive...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }

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
  onProgress?: (position: number, total: number, name: string) => void | Promise<void>
): Promise<void> {
  if (onProgress) {
    await onProgress(0, 100, 'Generating individual CSV files...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
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
  onProgress?: (position: number, total: number, name: string) => void | Promise<void>
): Promise<void> {
  if (onProgress) {
    await onProgress(0, 100, 'Preparing event data...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  const csv = generateEventUnifiedCsv(data, stimulusIds, participantIds, options, naming)
  if (onProgress) {
    await onProgress(100, 100, 'Downloading...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
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
  onProgress?: (position: number, total: number, name: string) => void | Promise<void>
): Promise<void> {
  if (onProgress) {
    await onProgress(0, 100, 'Generating individual event CSV files...')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
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
