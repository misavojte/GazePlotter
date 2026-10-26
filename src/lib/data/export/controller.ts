import { type DataType } from '$lib/data/types'
import { reportProgress, type ExportProgress } from './progress'
import { writeBlobZip, type ZipWriteEntry } from '$lib/data/zip/blobZip'
import { mediaEntryName } from '$lib/data/media/mediaEntries'
import type { StimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
import { generateScanGraph } from './mappers/scangraph'
import { generateWorkspaceJson } from './mappers/workspace'
import { segmentEntries } from '$lib/data/binary/storedSegments'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { WorkspaceLayoutItem } from '$lib/data/types'
import type { FileMetadataType } from '$lib/data/ingest/types'

/** The native workspace file extension. */
export const WORKSPACE_EXTENSION = '.gazeplotter'

/**
 * Make a user- or plot-derived string safe as a file name (download or zip
 * entry): strips path separators, reserved characters, and control characters,
 * then collapses whitespace.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

/** What a build produces. Delivery is the ExportService's job, through the
 *  session's `saveFile` embedding option. */
export type ExportPayload = { content: string | Blob; extension: string }

/**
 * Helper to package a batch of generated CSVs into a zip file with progress yielding.
 */
async function archiveBatch(
  batch: Array<{ fileName: string; content: string }>,
  zipFileName: string,
  onProgress?: ExportProgress
): Promise<Blob> {
  const entries: ZipWriteEntry[] = []
  const total = batch.length
  let count = 0

  for (const item of batch) {
    count++
    await reportProgress(onProgress, count, total, `Packaging ${item.fileName}`)
    entries.push({ name: `${item.fileName}_${zipFileName}.csv`, content: item.content })
  }

  await reportProgress(onProgress, total, total, 'Generating ZIP archive...')

  return (await writeBlobZip(entries)).blob
}

/**
 * Builds a tabular export: one unified CSV, or a ZIP of per-participant/stimulus
 * CSVs. `fileName` names the zip entries, not the delivered file; `kind`
 * prefixes the progress wording.
 */
export async function buildTabularExport(
  exportType: 'csv' | 'individual-csv',
  fileName: string,
  kind: '' | 'event ',
  unified: () => string,
  batch: () => Array<{ fileName: string; content: string }>,
  onProgress?: ExportProgress
): Promise<ExportPayload> {
  if (exportType === 'csv') {
    await reportProgress(onProgress, 0, 100, `Preparing ${kind}data...`)
    return { content: unified(), extension: '.csv' }
  }
  await reportProgress(onProgress, 0, 100, `Generating individual ${kind}CSV files...`)
  const blob = await archiveBatch(batch(), fileName, onProgress)
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
  layoutState: WorkspaceLayoutItem[],
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
    const name = mediaEntryName(id, data.stimuliMedia![id])
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
