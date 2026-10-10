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
import { writeBlobZip, type ZipWriteEntry } from '$lib/data/zip/blobZip'
import { mediaFileExtension } from '$lib/data/media/mediaUpload'
import type { StimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
import { generateScanGraph } from './mappers/scangraph'
import { generateWorkspaceJson } from './mappers/workspace'
import { segmentEntries } from '$lib/data/binary/storedSegments'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { AllGridTypes } from '$lib/workspace'
import type { FileMetadataType } from '$lib/data/ingest/types'

/** The native workspace file extension. */
export const WORKSPACE_EXTENSION = '.gazeplotter'

/** What a build produces. Delivery is the ExportService's job, through the
 *  session's `saveFile` embedding option. */
export type ExportPayload = { content: string | Blob; extension: string }

/**
 * Builds a unified CSV of all gaze segments.
 */
export async function buildUnifiedCsv(
  data: DataType,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  filterCategoryIds?: Set<number> | boolean,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<ExportPayload> {
  await reportProgress(onProgress, 0, 100, 'Preparing data...')
  const csv = generateUnifiedCsv(
    data,
    stimulusIds,
    participantIds,
    filterCategoryIds,
    options,
    naming
  )
  return { content: csv, extension: '.csv' }
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
 * Builds a ZIP of individual per-participant/stimulus CSVs. `fileName` names
 * the zip entries, not the delivered file.
 */
export async function buildBatchZip(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  filterCategoryIds?: Set<number> | boolean,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<ExportPayload> {
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
  return { content: blob, extension: '.zip' }
}

/**
 * Builds a unified CSV of all event occurrences.
 */
export async function buildEventUnifiedCsv(
  data: DataType,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<ExportPayload> {
  await reportProgress(onProgress, 0, 100, 'Preparing event data...')
  const csv = generateEventUnifiedCsv(data, stimulusIds, participantIds, options, naming)
  return { content: csv, extension: '.csv' }
}

/**
 * Builds a ZIP of per-participant/stimulus event CSVs. `fileName` names the
 * zip entries, not the delivered file.
 */
export async function buildEventBatchZip(
  data: DataType,
  fileName: string,
  stimulusIds?: Set<string>,
  participantIds?: Set<string>,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed',
  onProgress?: ExportProgress
): Promise<ExportPayload> {
  await reportProgress(onProgress, 0, 100, 'Generating individual event CSV files...')
  const batch = generateEventBatchCsv(data, stimulusIds, participantIds, options, naming)
  const blob = await archiveBatch(batch, fileName, onProgress)
  return { content: blob, extension: '.zip' }
}

/**
 * Builds a ScanGraph TXT file for a specific stimulus.
 */
export function buildScanGraph(
  engine: DataEngine,
  stimulusId: number,
  collapsed: boolean
): ExportPayload {
  return {
    content: generateScanGraph(engine, stimulusId, collapsed),
    extension: '.txt',
  }
}

/**
 * The workspace as one `.gazeplotter` file: a zip of a compact
 * `workspace.json`, the segment buffers as raw entries, and one stored
 * `media/<stimulusId>.<ext>` entry per medium (referenced, not copied into
 * memory). `skippedMedia` lists the stimuli whose bytes could not be read.
 */
export async function buildWorkspace(
  data: DataType,
  layoutState: AllGridTypes[],
  metadata: FileMetadataType | null,
  media: Pick<StimulusMediaStore, 'getBlob'>
): Promise<{ content: Blob; extension: string; skippedMedia: number[] }> {
  const entries: ZipWriteEntry[] = [
    {
      name: 'workspace.json',
      content: generateWorkspaceJson(data, layoutState, metadata, { storedSegments: true }),
      compress: true,
    },
    ...segmentEntries(data.segments),
  ]
  const idByEntry = new Map<string, number>()
  for (const id of Object.keys(data.stimuliMedia ?? {}).map(Number)) {
    const blob = media.getBlob(id)
    // Metadata ⇔ blob is an engine invariant; a missing blob here would mean
    // a bug upstream: skip the entry rather than export a broken archive.
    if (!blob) continue
    const name = `media/${id}.${mediaFileExtension(data.stimuliMedia![id])}`
    idByEntry.set(name, id)
    entries.push({ name, content: blob })
  }
  const { blob, skipped } = await writeBlobZip(entries)
  return {
    content: blob,
    extension: WORKSPACE_EXTENSION,
    skippedMedia: skipped.map(name => idByEntry.get(name)!),
  }
}
