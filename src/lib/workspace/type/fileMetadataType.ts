import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType'

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

/**
 * Metadata for failed file processing attempts.
 * Captures error information and context for debugging.
 */
export interface FileMetadataFailureType extends FileInputType {
  status: 'failure'
  errorMessage: string
  errorStack?: string
  attemptedParseDuration?: number // seconds - if we have partial timing
  gazePlotterVersion: string
  clientUserAgent: string
}

/**
 * Union type for file metadata that can represent either success or failure states.
 */
export type FileMetadataType = FileMetadataSuccessType | FileMetadataFailureType

/**
 * Legacy type for backward compatibility with older code.
 * @deprecated Use FileMetadataSuccessType instead
 */
export type FileMetadataLegacyType = Omit<FileMetadataSuccessType, 'status'>
