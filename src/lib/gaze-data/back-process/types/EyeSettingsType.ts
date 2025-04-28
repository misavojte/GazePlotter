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
  /** The type of eye-tracking data file (e.g., 'tobii', 'gazepoint', 'begaze', etc.) */
  type: string
  /** User-defined settings that can be applied to the data parsing */
  userInputSetting: string
  /** The row number (0-based) where the header information is located in the file */
  headerRowId: number
}
