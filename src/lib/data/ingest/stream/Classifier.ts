import type { EyeFileType, EyeSettingsType } from '../types'

/**
 * Class responsible for identifying and classifying eye-tracking data file formats.
 * This classifier analyzes file content to determine the appropriate parsing settings
 * for different eye-tracking data formats (Tobii, GazePoint, BeGaze, etc.).
 */
export class EyeClassifier {
  private readonly maxHeaderBytes = 256 * 1024

  private detectEncoding(bytes: Uint8Array): {
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be'
    bomLength: number
  } {
    if (bytes.length >= 3) {
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return { encoding: 'utf-8', bomLength: 3 }
      }
    }
    if (bytes.length >= 2) {
      if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return { encoding: 'utf-16le', bomLength: 2 }
      }
      if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return { encoding: 'utf-16be', bomLength: 2 }
      }
    }

    // Heuristic: detect UTF-16 by null bytes at even/odd positions
    const sampleLen = Math.min(bytes.length, 512)
    let zeroEven = 0
    let zeroOdd = 0
    for (let i = 0; i < sampleLen; i++) {
      if (bytes[i] !== 0) continue
      if (i % 2 === 0) zeroEven++
      else zeroOdd++
    }

    if (zeroOdd > zeroEven * 2) return { encoding: 'utf-16le', bomLength: 0 }
    if (zeroEven > zeroOdd * 2) return { encoding: 'utf-16be', bomLength: 0 }

    return { encoding: 'utf-8', bomLength: 0 }
  }

  private decodeHeaderFromBytes(bytes: Uint8Array): {
    text: string
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be'
  } {
    const limited = bytes.subarray(0, this.maxHeaderBytes)
    const { encoding, bomLength } = this.detectEncoding(limited)
    const decoder = new TextDecoder(encoding)
    const text = decoder.decode(limited.subarray(bomLength))
    return { text, encoding }
  }

  /**
   * Detects the row delimiter used in the file content.
   * @param slice - A portion of the file content to analyze
   * @returns The detected row delimiter ('\r\n', '\n', or '\r')
   */
  private detectRowDelimiter(slice: string): string {
    // Check for Windows line endings first (most common)
    if (slice.includes('\r\n')) return '\r\n'
    // Check for Unix line endings
    if (slice.includes('\n')) return '\n'
    // Check for Mac line endings (older Mac systems)
    if (slice.includes('\r')) return '\r'
    // Default to Unix line endings
    return '\n'
  }

  private getHeaderRow(slice: string): {
    header: string
    rowDelimiter: string
  } {
    const rowDelimiter = this.detectRowDelimiter(slice)
    const header = slice.split(rowDelimiter)[0] ?? ''
    return { header, rowDelimiter }
  }

  /**
   * Analyzes a slice of file content to determine the appropriate parsing settings.
   * @param slice - A portion of the file content to analyze
   * @returns EyeSettingsType object containing the determined parsing settings
   * @throws Error if the file type cannot be determined
   */
  classify(
    slice: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ): EyeSettingsType {
    const type = this.getTypeFromSlice(slice)
    if (type === 'unknown') throw new Error('Unknown file type')
    const rowDelimiter = this.detectRowDelimiter(slice)
    const columnDelimiter = this.getColumnDelimiter(type, slice)
    const headerRowId = type === 'ogama' ? 8 : 0
    return {
      type,
      rowDelimiter,
      columnDelimiter,
      encoding,
      userInputSetting: '',
      headerRowId,
    }
  }

  classifyFromBytes(bytes: Uint8Array): EyeSettingsType {
    const { text, encoding } = this.decodeHeaderFromBytes(bytes)
    return this.classify(text, encoding)
  }

  /**
   * Determines the eye-tracking data file type from a content slice.
   *
   * The order of checks matters: more specific formats are checked before more general ones
   * to avoid misclassification. For example, csv-segmented-duration must be checked before
   * csv-segmented, which must be checked before csv.
   *
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
    // Check duration-based segmented CSV before regular segmented CSV
    // because it's more specific (has additional required fields)
    if (this.isCsvSegmentedDuration(slice)) return 'csv-segmented-duration'
    if (this.isCsvSegmented(slice)) return 'csv-segmented'
    if (this.isCsv(slice)) return 'csv'
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
      case 'csv-segmented-duration':
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
    const { header } = this.getHeaderRow(slice)
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
   * Checks if the content matches duration-based segmented CSV file format.
   *
   * This format contains eye movement segments with duration-based timing:
   * - timestamp: Start time of the segment
   * - duration: Duration of the segment (end = timestamp + duration)
   * - eyemovementtype: Type of eye movement (0 = Fixation, 1 = Saccade)
   * - AOI: Area of Interest
   * - participant: Participant identifier
   * - stimulus: Stimulus identifier
   *
   * @param slice - A portion of the file content to analyze
   * @returns true if the content matches duration-based segmented CSV format
   */
  isCsvSegmentedDuration(slice: string): boolean {
    return (
      slice.includes('timestamp') &&
      slice.includes('duration') &&
      slice.includes('eyemovementtype') &&
      slice.includes('participant') &&
      slice.includes('stimulus') &&
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
    const { header } = this.getHeaderRow(slice)
    const internationalDelimiterCount = header.split(
      internationalDelimiter
    ).length
    const germanDelimiterCount = header.split(germanDelimiter).length
    return internationalDelimiterCount > germanDelimiterCount
      ? internationalDelimiter
      : germanDelimiter
  }
}
