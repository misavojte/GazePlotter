/**
 * One upload, in process: the steps the app's ingest service runs around the
 * worker (partition, starter seeding, event files) as plain functions, and
 * `ingest`, which composes them with the job for headless callers. Files are
 * `File`s: a browser upload, or in Node `new File([await openAsBlob(path)], name)`.
 */
import { DataEngine } from '../engine/dataEngine.svelte'
import type { DataType, EventDataUpdate } from '../types'
import type { WorkspaceLayoutItem } from '../types'
import { createDefaultMetricInstances } from '$lib/metrics/instances'
import { mediaKindOf } from '../media/stimulusMedia'
import { foldMerges } from '../merge/applyMerges'
import {
  buildDataTypeFromCsvEvents,
  mergeIntoStimulusMap,
  parseCsvEventText,
  resolveContributionsForEngine,
  type StimulusMap,
} from './formats/csvEvent'
import { FORMAT_REGISTRY, detectEnrichmentFormat } from './formats/registry'
import type { EnrichmentFormatDefinition } from './kernel/format'
import { IngestJob } from './kernel/job'
import type { IngestResult } from './kernel/result'
import type { EventContribution } from './kernel/sink'
import { blobSource, probeFromText } from './kernel/source'

/** An upload file claimed by an enrichment format during partition. */
export type ClaimedEventFile = { file: File; format: EnrichmentFormatDefinition }

/**
 * Partitions uploaded files into eye-tracking sources (for the job), event
 * files (claimed by ENRICHMENT_FORMATS, consumed after the load), and
 * stimulus reference media (images/videos, matched to stimuli by file name
 * after the load). Detection is registry-driven. One routing policy lives
 * here, not in a format: a LONE .json upload is never an event file
 * (workspace first-file-wins precedence).
 */
export async function partitionUploadFiles(files: File[]): Promise<{
  eyeFiles: File[]
  eventFiles: ClaimedEventFile[]
  mediaFiles: File[]
}> {
  const eyeFiles: File[] = []
  const eventFiles: ClaimedEventFile[] = []
  const mediaFiles: File[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'gazeplotter' || (ext === 'json' && files.length === 1)) {
      eyeFiles.push(file)
      continue
    }
    // Media is claimed by mime/extension BEFORE the text probe: the content
    // is binary and no data format could ever claim it.
    if (mediaKindOf(file) !== null) {
      mediaFiles.push(file)
      continue
    }
    try {
      const slice = await file.slice(0, 256 * 1024).text()
      const format = detectEnrichmentFormat(probeFromText(slice, { fileName: file.name }))
      if (format) {
        eventFiles.push({ file, format })
        continue
      }
    } catch {
      // Unreadable probe: let the job report the real error.
    }
    eyeFiles.push(file)
  }
  return { eyeFiles, eventFiles, mediaFiles }
}

/** Fresh datasets get the starter metric library; a workspace carries its own. */
export function seedStarterMetrics(data: DataType): DataType {
  data.metricInstances = createDefaultMetricInstances()
  return data
}

/** The rows of CSV event files, each warning prefixed with its file name. */
export async function csvEventContributions(
  files: File[]
): Promise<{ byFile: { name: string; contributions: EventContribution[] }[]; warnings: string[] }> {
  const warnings: string[] = []
  const byFile = []
  for (const file of files) {
    const parsed = parseCsvEventText(await file.text())
    warnings.push(...parsed.warnings.map(w => `${file.name}: ${w}`))
    byFile.push({ name: file.name, contributions: parsed.contributions })
  }
  return { byFile, warnings }
}

/** A dataset from CSV event rows alone (an event-only upload). */
export function eventOnlyDataset(
  contributions: EventContribution[]
): { data: DataType; warnings: string[] } {
  const built = buildDataTypeFromCsvEvents(contributions)
  return { data: seedStarterMetrics(built.data), warnings: built.warnings }
}

/** CSV event rows resolved against the loaded dataset's stimulus and
 *  participant names, merged into one map per stimulus. */
export function resolveCsvEvents(
  engine: DataEngine,
  byFile: { name: string; contributions: EventContribution[] }[],
  into: StimulusMap = new Map()
): { stimulusMap: StimulusMap; warnings: string[] } {
  const meta = engine.metadata!
  const warnings: string[] = []
  for (const { name, contributions } of byFile) {
    const resolved = resolveContributionsForEngine(
      contributions,
      meta.stimuli.data,
      meta.participants.data,
      meta.participants.data.length,
      meta.aois.data
    )
    warnings.push(...resolved.warnings.map(w => `${name}: ${w}`))
    mergeIntoStimulusMap(into, resolved.stimulusMap)
  }
  return { stimulusMap: into, warnings }
}

/** The per-stimulus replacement payloads a stimulus map amounts to. */
export function eventUpdatesOf(stimulusMap: StimulusMap): EventDataUpdate[] {
  return [...stimulusMap].map(([stimulusId, channels]) => ({
    stimulusId,
    channelDefs: [...channels.values()].map(c => c.def),
    eventBuffers: [...channels.values()].map(c => c.perParticipant),
  }))
}

export interface IngestOptions {
  /** Answers to format prompts by prompt id. Tobii exports with an Event
   *  column ask 'tobii-parsing-input' (a JSON TobiiParsingConfig; '' for
   *  media-column stimuli). An unanswered prompt is an error. */
  prompts?: Record<string, string>
}

export interface Ingested {
  engine: DataEngine
  /** 'dataset' for recordings, 'workspace' for a saved GazePlotter file. */
  kind: IngestResult['kind']
  warnings: string[]
  /** The saved plot layout of a workspace file. */
  gridItems?: WorkspaceLayoutItem[]
}

/** The whole upload, headless: no worker, no dialogs, no media decoding. */
export async function ingest(files: File[], options: IngestOptions = {}): Promise<Ingested> {
  const { eyeFiles, eventFiles, mediaFiles } = await partitionUploadFiles(files)
  const warnings = mediaFiles.map(f => `${f.name}: reference media is not loaded headlessly`)
  const csvFiles: File[] = []
  for (const { file, format } of eventFiles) {
    if (format.consume !== 'contributions')
      throw new Error(`${file.name}: ${format.displayName} files are mapped in the app, not headlessly`)
    csvFiles.push(file)
  }
  const events = await csvEventContributions(csvFiles)
  warnings.push(...events.warnings)

  const engine = new DataEngine()
  if (eyeFiles.length === 0) {
    const contributions = events.byFile.flatMap(f => f.contributions)
    if (contributions.length === 0) throw new Error('No gaze data and no valid event rows')
    const built = eventOnlyDataset(contributions)
    warnings.push(...built.warnings)
    engine.loadDataset(built.data)
    return { engine, kind: 'dataset', warnings }
  }

  const job = new IngestJob(
    eyeFiles.map(f => f.name),
    FORMAT_REGISTRY,
    {
      // A prompt is a parsing decision; headless, it is answered up front or
      // the run stops, never guessed.
      prompt: async id => {
        const answer = options.prompts?.[id]
        if (answer === undefined)
          throw new Error(`The files need an answer to prompt '${id}'; pass prompts: { '${id}': value }`)
        return answer
      },
      reportBytes: () => {},
    }
  )
  let result: IngestResult | null = null
  for (const file of eyeFiles) result = await job.add(blobSource(file.name, file))
  if (!result) throw new Error('No files to ingest')
  if (result.kind === 'dataset') {
    seedStarterMetrics(result.data)
    warnings.push(...(result.warnings ?? []))
  }
  for (const dropped of result.data.dataExclusions ?? []) {
    warnings.push(`${dropped.participant} on ${dropped.stimulus} excluded: malformed interval markers`)
  }
  // A workspace file is original-on-disk: pristine data plus the merge log,
  // folded on load as the app does in applyParsedData.
  engine.loadDataset(result.kind === 'workspace' ? foldMerges(result.data) : result.data)
  if (events.byFile.length > 0) {
    const resolved = resolveCsvEvents(engine, events.byFile)
    warnings.push(...resolved.warnings)
    engine.updateEventDataBatch(eventUpdatesOf(resolved.stimulusMap))
  }
  return {
    engine,
    kind: result.kind,
    warnings,
    gridItems: result.kind === 'workspace' ? result.gridItems : undefined,
  }
}
