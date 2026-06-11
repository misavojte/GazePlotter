/**
 * Format contract — see `src/lib/data/ingest/README.md` for the model and
 * `src/lib/data/ingest/formats/` for every implementation.
 *
 * A format is a self-contained module that (1) recognizes its files from a
 * `SourceProbe` and (2) reads them into the `DatasetSink`. There are four
 * kinds, distinguished by what they consume and produce:
 *
 *  - 'stream'     sequential text data, read file-by-file into the shared
 *                 sink (all eye-tracker exports).
 *  - 'archive'    fully-materialized binary bundles, read as one group into
 *                 the shared sink (Pupil Cloud zips).
 *  - 'workspace'  a single self-describing file that IS the whole result
 *                 (saved GazePlotter workspace JSON).
 *  - 'enrichment' event files that annotate a dataset rather than carry
 *                 gaze data. Claimed at detection like every other kind,
 *                 but parsed AFTER the dataset exists (their names resolve
 *                 against dictionaries that segments produce), on the main
 *                 thread — the job never sees them.
 */
import type { IngestContext } from './context'
import type { IngestResult } from './result'
import type { DatasetSink, EventContribution } from './sink'
import type { OpenedSource, SourceProbe } from './source'
import type { ParseSettings } from '../types'

/** Everything a stream format's `read` receives for one source. */
export interface StreamFormatInput {
  /** Source with its first chunk already read (it was used for detection).
      Process `opened.firstChunk` first, then drain `opened.reader`. */
  opened: OpenedSource
  /** The id `detect` resolved for this source (e.g. 'tobii-with-event'). */
  typeId: string
  probe: SourceProbe
  settings: ParseSettings
  /** Prompt answer when the format requires user input, '' otherwise. */
  userInput: string
}

export interface StreamFormatDefinition {
  kind: 'stream'
  /** All type ids this module can resolve. Ids are persisted in workspace
      files (`parseSettings.type`) — append-only, never rename. */
  ids: readonly string[]
  displayName: string
  /**
   * Content sniff against the probe. Returns the resolved type id, or null
   * when the source is not this format. Must be cheap and side-effect free.
   * Registry order decides ties — see `formats/registry.ts`.
   */
  detect(probe: SourceProbe): string | null
  /** Static column delimiter, or content-derived (the csv family). */
  columnDelimiter: string | ((probe: SourceProbe) => string)
  /** 0-based row index of the header row. Default 0 (Ogama: 8). */
  headerRowId?: number
  /** Prompt to run (via `IngestContext.prompt`) before reading, when
      `requiresUserInput(typeId)` is true. */
  promptId?: string
  requiresUserInput?(typeId: string): boolean
  /**
   * Format-specific message for "parsing produced no stimuli", shown instead
   * of the generic one. Return null to keep the generic message.
   */
  emptyDatasetError?(userInput: string): string | null
  /**
   * Read one source into the sink. Called once per matched source, in
   * upload order (so a format never sees sources it didn't claim, and
   * multi-file uploads keep their arrival order in the shared dictionaries).
   */
  read(
    input: StreamFormatInput,
    sink: DatasetSink,
    ctx: IngestContext
  ): Promise<void>
}

export interface ArchiveFormatInput {
  name: string
  bytes: Uint8Array
}

export interface ArchiveFormatDefinition {
  kind: 'archive'
  /** Persisted type id (e.g. 'pupil-cloud-zip') — append-only. */
  id: string
  displayName: string
  /** Archive formats are claimed by file name before any bytes arrive
      (the client must decide to send whole buffers, not streams). */
  matchesFileName(fileName: string): boolean
  /**
   * Read ALL claimed sources in one call (a multi-archive upload is one
   * logical dataset — e.g. one Pupil Cloud zip per stimulus). Returns the
   * parse settings to report for the upload.
   */
  read(
    inputs: ArchiveFormatInput[],
    sink: DatasetSink,
    ctx: IngestContext
  ): Promise<{ settings: ParseSettings }>
}

export interface WorkspaceFormatDefinition {
  kind: 'workspace'
  id: string
  displayName: string
  matchesFileName(fileName: string): boolean
  /** A workspace file is the whole result — no sink involved. */
  read(bytes: Uint8Array, ctx: IngestContext): Promise<IngestResult>
}

/**
 * Event files claimed at detection, consumed post-load. Two consumption
 * modes: 'contributions' formats are self-contained text→events parses
 * (resolution happens later via the shared event currency); 'interactive'
 * formats need a main-thread mapping flow (the legacy AOI-visibility
 * files, which carry no stimulus/participant names of their own).
 */
export type EnrichmentFormatDefinition = {
  kind: 'enrichment'
  id: string
  displayName: string
  /** Content sniff against the probe. Cheap and side-effect free, like
      stream detection; enrichment runs BEFORE stream detection. */
  detect(probe: SourceProbe): boolean
} & (
  | {
      consume: 'contributions'
      parse(text: string): {
        contributions: EventContribution[]
        warnings: string[]
      }
    }
  | { consume: 'interactive' }
)

export type FormatDefinition =
  | StreamFormatDefinition
  | ArchiveFormatDefinition
  | WorkspaceFormatDefinition
  | EnrichmentFormatDefinition

export function resolveColumnDelimiter(
  def: StreamFormatDefinition,
  probe: SourceProbe
): string {
  return typeof def.columnDelimiter === 'function'
    ? def.columnDelimiter(probe)
    : def.columnDelimiter
}

/** Assembles the persisted `ParseSettings` for a detected stream source. */
export function buildParseSettings(
  def: StreamFormatDefinition,
  typeId: string,
  probe: SourceProbe,
  userInput: string
): ParseSettings {
  return {
    type: typeId,
    rowDelimiter: probe.rowDelimiter,
    columnDelimiter: resolveColumnDelimiter(def, probe),
    encoding: probe.encoding,
    userInputSetting: userInput,
    headerRowId: def.headerRowId ?? 0,
  }
}
