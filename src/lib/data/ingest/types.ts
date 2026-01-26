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
