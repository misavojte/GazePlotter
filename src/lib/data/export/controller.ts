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
import { generateScanGraph } from './mappers/scangraph'
import { generateWorkspaceJson } from './mappers/workspace'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { AllGridTypes } from '$lib/workspace'
import type { FileMetadataType } from '$lib/data/ingest/types'

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
 * Builds the entire workspace state. Without stimulus media this is the
 * plain JSON of always — byte-compatible with older exports. With media it
 * becomes a `.gazeplotter.zip` archive: the same `workspace.json` plus one
 * `media/<stimulusId>.<ext>` entry per medium, added as Blobs (JSZip streams
 * them — the bytes are never base64'd or copied into a JS string).
 */
export async function buildWorkspace(
  data: DataType,
  layoutState: AllGridTypes[],
  metadata: FileMetadataType | null
): Promise<ExportPayload> {
  const json = generateWorkspaceJson(data, layoutState, metadata)

  const mediaIds = Object.keys(data.stimuliMedia ?? {}).map(Number)
  if (mediaIds.length === 0) {
    return { content: json, extension: '.json' }
  }

  const { stimulusMediaStore, mediaFileExtension } = await import(
    '$lib/data/media/mediaStore.svelte'
  )
  const archiver = new Archiver()
  archiver.addFile('workspace.json', json)
  for (const id of mediaIds) {
    const media = data.stimuliMedia![id]
    const blob = stimulusMediaStore.getBlob(id)
    // Metadata ⇔ blob is an engine invariant; a missing blob here would mean
    // a bug upstream — skip the entry rather than export a broken archive.
    if (!blob) continue
    // ArrayBuffer, not Blob: JSZip buffers blob content in memory anyway and
    // rejects Blobs outright in non-browser hosts.
    archiver.addFile(
      `media/${id}.${mediaFileExtension(media)}`,
      await blob.arrayBuffer()
    )
  }
  return { content: await archiver.generateBlob(), extension: '.gazeplotter.zip' }
}
