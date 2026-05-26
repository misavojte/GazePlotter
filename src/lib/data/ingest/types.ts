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
 * Function that prepares the initial files for a GazePlotter session. The
 * returned `File`s flow through the same ingest pipeline used by drag-drop
 * and the upload button — classification, parsing, and error reporting are
 * the library's concern, not the loader's.
 *
 * Called **once per `<GazePlotter>` mount**. To re-trigger the load
 * imperatively, call `resetLayout()` on the component instance. To re-trigger
 * declaratively when an input changes, wrap the component in `{#key value}`.
 *
 * Contract:
 * - **Files**: return one or more `File` objects with meaningful names. The
 *   extension drives classification (`.json` workspace, `.csv`, `.zip`, …).
 *   Return `[]` to bootstrap with no preloaded data — the workspace opens
 *   ready, with the upload UI immediately available.
 * - **Errors**: throw an `Error` whose `message` is user-facing — GazePlotter
 *   surfaces it verbatim in the toast / "Data Load Failed" indicator. Wrap
 *   the underlying cause via `new Error(message, { cause })` to preserve it
 *   in the metadata report.
 * - **Cancellation**: the `signal` aborts when the load is superseded
 *   (component unmount or `resetLayout()`). Honour it by forwarding to
 *   `fetch(..., { signal })` and bailing on abort. When `signal.aborted`
 *   becomes true the library silently drops any subsequent rejection or
 *   result; rejections that surface while the signal is *not* aborted —
 *   including stray `AbortError`s from your own logic — are reported as
 *   fatal-load errors.
 *
 * How URLs, IndexedDB, host bridges, OAuth pickers, etc. produce these files
 * is out of scope for GazePlotter — that construction lives in the consumer.
 * For the common "single file over HTTP" case, use the bundled
 * {@link fromUrl} helper.
 */
export type DataLoader = (signal: AbortSignal) => Promise<File[]>
