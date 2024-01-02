import type { EyeFileType } from '$lib/type/EyeFile/EyeFileType.js'
import type { EyeSettingsType } from '$lib/type/Settings/EyeSettings/EyeSettingsType.js'

export class EyeClassifier {
  classify (slice: string): EyeSettingsType {
    const type = this.getTypeFromSlice(slice)
    if (type === 'unknown') throw new Error('Unknown file type')
    const rowDelimiter = '\r\n'
    const columnDelimiter = this.getColumnDelimiter(type)
    const headerRowId = type === 'ogama' ? 8 : 0
    return { type, rowDelimiter, columnDelimiter, userInputSetting: '', headerRowId }
  }

  getTypeFromSlice (slice: string): EyeFileType {
    if (this.isTobii(slice)) {
      if (slice.includes('Event')) return 'tobii-with-event'
      return 'tobii'
    }
    if (this.isGazePoint(slice)) return 'gazepoint'
    if (this.isBeGaze(slice)) return 'begaze'
    if (this.isOgama(slice)) return 'ogama'
    if (this.isVarjo(slice)) return 'varjo'
    if (this.isCsv(slice)) return 'csv'
    return 'unknown'
  }

  getColumnDelimiter (type: EyeFileType): string {
    switch (type) {
      case 'tobii':
      case 'tobii-with-event':
      case 'begaze':
      case 'ogama':
        return '\t'
      case 'gazepoint':
      case 'csv':
        return ','
      case 'varjo':
        return ';'
      default:
        throw new Error('Unknown file type')
    }
  }

  isTobii (slice: string): boolean {
    return slice.includes('Recording timestamp')
  }

  isGazePoint (slice: string): boolean {
    return slice.includes('FPOGS') && slice.includes('FPOGD')
  }

  isBeGaze (slice: string): boolean {
    return slice.includes('Event Start Trial Time [ms]') && slice.includes('Event End Trial Time [ms]')
  }

  isOgama (slice: string): boolean {
    return slice.includes('# Contents: Similarity Measurements of scanpaths.')
  }

  isVarjo (slice: string): boolean {
    return slice.includes('Time') && slice.includes('Actor Label')
  }

  isCsv (slice: string): boolean {
    return slice.includes('Time') && slice.includes('Participant') && slice.includes('Stimulus') && slice.includes('AOI')
  }
}
