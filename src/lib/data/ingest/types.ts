import type { ErrorRecord } from '$lib/errors'

/**
 * Settings used to parse one uploaded file. Produced by format detection,
 * persisted verbatim inside workspace JSON as `fileMetadata.parseSettings`.
 *
 * SERIALIZATION CONTRACT: the JSON shape of this object and the existing
 * `type` string values ('tobii', 'csv-segmented-duration', …) are frozen —
 * old workspace files must keep loading. New formats may add new `type`
 * values (append-only), never rename existing ones.
 */
export interface ParseSettings {
  /** The character or string used to separate rows in the data file */
  rowDelimiter: string
  /** The character or string used to separate columns in the data file */
  columnDelimiter: string
  /** The detected text encoding for the header (used only for header decoding) */
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be'
  /** The format type id (e.g. 'tobii', 'begaze' — see formats/registry.ts) */
  type: string
  /** User-provided setting captured via an ingest prompt (e.g. Tobii media parsing) */
  userInputSetting: string
  /** The row number (0-based) where the header information is located in the file */
  headerRowId: number
}

/**
 * One parsed segment row in string form — the slow-path input to
 * `SegmentWriter.add`. Hot-path formats emit bytes via
 * `DatasetSink.addSegmentBytes` instead.
 */
export interface SegmentRow {
  start: string
  end: string
  stimulus: string
  participant: string
  category: string
  aoi: string[] | null
}

/**
 * Basic file input information captured when files are selected.
 * This is available for both successful and failed file processing.
 */
export interface FileInputType {
  fileNames: string[]
  fileSizes: number[] // bytes
  parseDate: string // YYYY-MM-DD HH:MM:SS in UTC
}

/**
 * Complete metadata for successfully processed files.
 * Extends FileInputType with additional parse settings and system information.
 */
export interface FileMetadataSuccessType extends FileInputType {
  status: 'success'
  parseSettings: ParseSettings
  parseDuration: number // seconds
  gazePlotterVersion: string
  clientUserAgent: string // e.g. "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

export interface FileMetadataFailureType extends FileInputType {
  status: 'failure'
  errorId: ErrorRecord['id']
  errorCreatedAt: ErrorRecord['createdAt']
  userMessage: ErrorRecord['userMessage']
  debugMessage: ErrorRecord['debugMessage']
  stack?: ErrorRecord['stack']
  attemptedParseDuration?: number // seconds - if we have partial timing
  gazePlotterVersion: string
  clientUserAgent: string
}

/**
 * Union type for file metadata that can represent either success or failure states.
 */
export type FileMetadataType = FileMetadataSuccessType | FileMetadataFailureType

/**
 * Prepares the initial files for a GazePlotter session. The returned `File`s
 * flow through the same ingest job as drag-drop / the upload button —
 * detection, parsing, and error reporting are the library's concern.
 *
 * Called **once per `<GazePlotter>` mount**. To re-trigger, call
 * `resetLayout()` on the instance or remount via `{#key value}`.
 *
 * Contract:
 * - **Files**: return one or more `File`s with meaningful names — the
 *   extension drives classification (`.json` workspace, `.csv`, `.zip`, …).
 *   Return `[]` to open an empty workspace with upload UI ready.
 * - **Errors**: throw `Error` whose `message` is user-facing — GazePlotter
 *   surfaces it verbatim. Use `new Error(msg, { cause })` to preserve the
 *   underlying error in the metadata report.
 * - **Cancellation**: the `signal` aborts when the load is superseded
 *   (unmount or `resetLayout()`). Forward it to `fetch(..., { signal })`.
 *   While `signal.aborted`, the library drops rejections silently; any
 *   rejection that surfaces *before* abort — including stray `AbortError`s
 *   from your own logic — is reported as a fatal-load error.
 */
export type DataLoader = (signal: AbortSignal) => Promise<File[]>
