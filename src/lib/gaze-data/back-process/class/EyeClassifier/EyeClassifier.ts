import type { EyeFileType } from '$lib/gaze-data/back-process/types/EyeFileType.js'
import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType.js'

/**
 * Class responsible for identifying and classifying eye-tracking data file formats.
 * This classifier analyzes file content to determine the appropriate parsing settings
 * for different eye-tracking data formats (Tobii, GazePoint, BeGaze, etc.).
 */
export class EyeClassifier {
  /**
   * Analyzes a slice of file content to determine the appropriate parsing settings.
   * @param slice - A portion of the file content to analyze
   * @returns EyeSettingsType object containing the determined parsing settings
   * @throws Error if the file type cannot be determined
   */
  classify(slice: string): EyeSettingsType {
    const type = this.getTypeFromSlice(slice)
    if (type === 'unknown') throw new Error('Unknown file type')
    const rowDelimiter = '\r\n'
    const columnDelimiter = this.getColumnDelimiter(type, slice)
    const headerRowId = type === 'ogama' ? 8 : 0
    return {
      type,
      rowDelimiter,
      columnDelimiter,
      userInputSetting: '',
      headerRowId,
    }
  }

  /**
   * Determines the eye-tracking data file type from a content slice.
   * @param slice - A portion of the file content to analyze
   * @returns The identified EyeFileType or 'unknown' if type cannot be determined
   */
  getTypeFromSlice(slice: string): EyeFileType {
    if (this.isTobii(slice)) {
      if (slice.includes('Event')) return 'tobii-with-event'
      return 'tobii'
    }
    if (this.isGazePoint(slice)) return 'gazepoint'
    if (this.isBeGaze(slice)) return 'begaze'
    if (this.isOgama(slice)) return 'ogama'
    if (this.isVarjo(slice)) return 'varjo'
    if (this.isCsv(slice)) return 'csv'
    if (this.isCsvSegmented(slice)) return 'csv-segmented'
    return 'unknown'
  }

  /**
   * Determines the appropriate column delimiter based on file type and content.
   * @param type - The identified eye-tracking file type
   * @param slice - A portion of the file content to analyze
   * @returns The appropriate column delimiter character
   * @throws Error if the file type is unknown
   */
  getColumnDelimiter(type: EyeFileType, slice: string): string {
    switch (type) {
      case 'tobii':
      case 'tobii-with-event':
      case 'begaze':
      case 'ogama':
        return '\t'
      case 'gazepoint':
        return ','
      case 'csv':
      case 'csv-segmented':
        return this.determineCsvDelimiter(slice)
      case 'varjo':
        return ';'
      default:
        throw new Error('Unknown file type')
    }
  }

  /**
   * Checks if the content matches Tobii file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches Tobii format
   */
  isTobii(slice: string): boolean {
    return slice.includes('Recording timestamp')
  }

  /**
   * Checks if the content matches GazePoint file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches GazePoint format
   */
  isGazePoint(slice: string): boolean {
    return slice.includes('FPOGS') && slice.includes('FPOGD')
  }

  /**
   * Checks if the content matches BeGaze file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches BeGaze format
   */
  isBeGaze(slice: string): boolean {
    return (
      slice.includes('Event Start Trial Time [ms]') &&
      slice.includes('Event End Trial Time [ms]')
    )
  }

  /**
   * Checks if the content matches OGAMA file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches OGAMA format
   */
  isOgama(slice: string): boolean {
    return slice.includes('# Contents: Similarity Measurements of scanpaths.')
  }

  /**
   * Checks if the content matches Varjo file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches Varjo format
   */
  isVarjo(slice: string): boolean {
    return slice.includes('Time') && slice.includes('Actor Label')
  }

  /**
   * Checks if the content matches standard CSV file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches standard CSV format
   */
  isCsv(slice: string): boolean {
    const header = slice.split('\r\n')[0]
    const headerColumns = header.split(',')
    return (
      headerColumns.includes('Time') &&
      headerColumns.includes('Participant') &&
      headerColumns.includes('Stimulus') &&
      headerColumns.includes('AOI')
    )
  }

  /**
   * Checks if the content matches segmented CSV file format.
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches segmented CSV format
   */
  isCsvSegmented(slice: string): boolean {
    return (
      slice.includes('From') &&
      slice.includes('To') &&
      slice.includes('Participant') &&
      slice.includes('Stimulus') &&
      slice.includes('AOI')
    )
  }

  /**
   * To determine the delimiter used in a CSV file, we count the number of occurrences of the two most common delimiters
   * (',' and ';') in the header row. The delimiter with the higher count is used.
   *
   * @param slice - Text content of the first slice of the file, containing the header row
   * @returns delimiter used in the CSV file (either ',' or ';')
   */
  determineCsvDelimiter(slice: string): string {
    const internationalDelimiter = ','
    const germanDelimiter = ';'
    const headerOnly = slice.split('\r\n')[0]
    const internationalDelimiterCount = headerOnly.split(
      internationalDelimiter
    ).length
    const germanDelimiterCount = headerOnly.split(germanDelimiter).length
    return internationalDelimiterCount > germanDelimiterCount
      ? internationalDelimiter
      : germanDelimiter
  }
}
