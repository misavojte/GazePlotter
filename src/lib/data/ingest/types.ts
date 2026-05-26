import type { ErrorRecord } from '$lib/errors'

/**
 * Types of eye tracking files accepted by the application.
 * Determines which deserializer is used to parse the file.
 *
 * Except for the 'unknown' type, which is used when the type of the file is not known.
 */
export type EyeFileType =
  | 'tobii'
  | 'gazepoint'
  | 'begaze'
  | 'unknown'
  | 'tobii-with-event'
  | 'ogama'
  | 'varjo'
  | 'csv'
  | 'csv-segmented'
  | 'csv-segmented-duration'
  | 'pupil-cloud-zip'

/**
 * Interface representing the settings for parsing eye-tracking data files.
 * This type defines the structure and delimiters needed to correctly parse
 * different eye-tracking data file formats.
 */
export interface EyeSettingsType {
  /** The character or string used to separate rows in the data file */
  rowDelimiter: string
  /** The character or string used to separate columns in the data file */
  columnDelimiter: string
  /** The detected text encoding for the header (used only for header decoding) */
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be'
  /** The type of eye-tracking data file (e.g., 'tobii', 'gazepoint', 'begaze', etc.) */
  type: string
  /** User-defined settings that can be applied to the data parsing */
  userInputSetting: string
  /** The row number (0-based) where the header information is located in the file */
  headerRowId: number
}

export interface SingleDeserializerOutput {
  start: string
  end: string
  stimulus: string
  participant: string
  category: string
  aoi: string[] | null
}

export type DeserializerOutputType =
  | SingleDeserializerOutput
  | null
  | SingleDeserializerOutput[]

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
  parseSettings: EyeSettingsType
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
 * flow through the same ingest pipeline as drag-drop / the upload button —
 * classification, parsing, and error reporting are the library's concern.
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
