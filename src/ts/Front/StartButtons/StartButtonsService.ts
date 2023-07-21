import { EyeTrackingFileType } from '../../Types/Parsing/FileTypes'
import { StartButtonsPreParseSettingsType } from '../../Types/Parsing/StartButtonsPreParseSettingsType'

export class StartButtonsService {
  async preprocessEyeTrackingFiles (filesToPreprocess: FileList): Promise<StartButtonsPreParseSettingsType> {
    const fileNames: string[] = []
    const files: File[] = []
    const types: EyeTrackingFileType[] = []
    for (let i = 0; i < filesToPreprocess.length; i++) {
      const file = filesToPreprocess[i]
      const slice = await this.getSlice(file)
      const type = this.getTypeFromSlice(slice)
      if (type === 'unknown') continue
      types.push(type)
      fileNames.push(file.name)
      files.push(file)
    }
    const type = this.getTypeFromArray(types)
    const rowDelimiter = '\r\n'
    const columnDelimiter = this.getColumnDelimiter(type)
    return { workerSettings: { type, rowDelimiter, columnDelimiter, fileNames, userInputSetting: null }, files }
  }

  async getSlice (file: File): Promise<string> {
    const slice = file.slice(0, 1000)
    const reader = new FileReader()
    reader.readAsText(slice)
    return await new Promise((resolve) => {
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') resolve(result)
      }
    })
  }

  getTypeFromArray (array: EyeTrackingFileType[]): EyeTrackingFileType {
    if (array.length === 0) return 'unknown'
    if (array.every((x) => x === array[0])) return array[0]
    throw new Error('Mixed file types')
  }

  getTypeFromSlice (slice: string): EyeTrackingFileType {
    if (this.isTobii(slice)) {
      if (slice.includes('Event')) return 'tobii-with-event'
      return 'tobii'
    }
    if (this.isGazePoint(slice)) return 'gazepoint'
    if (this.isBeGaze(slice)) return 'begaze'
    if (this.isOgama(slice)) return 'ogama'
    if (this.isVarjo(slice)) return 'varjo'
    return 'unknown'
  }

  getColumnDelimiter (type: EyeTrackingFileType): string {
    switch (type) {
      case 'tobii':
      case 'tobii-with-event':
      case 'begaze':
      case 'ogama':
        return '\t'
      case 'gazepoint':
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
}
