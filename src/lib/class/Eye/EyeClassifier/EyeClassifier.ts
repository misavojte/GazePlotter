import type { EyeFileType } from '$lib/type/EyeFile/EyeFileType.js'
import type { EyeSettingsType } from '$lib/type/Settings/EyeSettings/EyeSettingsType.js'

export class EyeClassifier {
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

  isTobii(slice: string): boolean {
    return slice.includes('Recording timestamp')
  }

  isGazePoint(slice: string): boolean {
    return slice.includes('FPOGS') && slice.includes('FPOGD')
  }

  isBeGaze(slice: string): boolean {
    return (
      slice.includes('Event Start Trial Time [ms]') &&
      slice.includes('Event End Trial Time [ms]')
    )
  }

  isOgama(slice: string): boolean {
    return slice.includes('# Contents: Similarity Measurements of scanpaths.')
  }

  isVarjo(slice: string): boolean {
    return slice.includes('Time') && slice.includes('Actor Label')
  }

  isCsv(slice: string): boolean {
    return (
      slice.includes('Time') &&
      slice.includes('Participant') &&
      slice.includes('Stimulus') &&
      slice.includes('AOI')
    )
  }

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
