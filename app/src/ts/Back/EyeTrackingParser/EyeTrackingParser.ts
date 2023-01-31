import { ETDInterface } from '../../Data/EyeTrackingData'
import { EyeTrackingParserAbstractReducer } from './Reducer/EyeTrackingParserAbstractReducer'
import { EyeTrackingParserRowStore } from './EyeTrackingParserRowStore'
import { EyeTrackingParserBeGazeReducer } from './Reducer/EyeTrackingParserBeGazeReducer'
import { EyeTrackingParserTobiiReducer } from './Reducer/EyeTrackingParserTobiiReducer'
import { EyeTrackingParserBeGazePostprocessor } from './Postprocessor/EyeTrackingParserBeGazePostprocessor'
import { EyeTrackingParserTobiiPostprocessor } from './Postprocessor/EyeTrackingParserTobiiPostprocessor'
import { EyeTrackingParserGazePointReducer } from './Reducer/EyeTrackingParserGazePointReducer'

export class EyeTrackingParser {
  lastRow: string = ''
  columnsIntegrity: number = 0 // for rows integrity check
  fileNames: string[]
  fileParsed: number = 0
  fileType: string | null = null
  rowSeparator: string
  rowReducer: EyeTrackingParserAbstractReducer | null = null
  rowStore: EyeTrackingParserRowStore = new EyeTrackingParserRowStore()
  isPreviousFileProcessed: Promise<void> = Promise.resolve()
  get filesToParse (): number { return this.fileNames.length }
  get currentFileName (): string { return this.fileNames[this.fileParsed] }

  constructor (fileNames: string[]) {
    this.fileNames = fileNames
    this.rowSeparator = this.getRowSeparator()
  }

  async process (rs: ReadableStream): Promise<ETDInterface | null> {
    if (this.filesToParse === 0) throw new Error('Number of files to parse was not set')
    await this.isPreviousFileProcessed
    if (this.rowSeparator === null) throw new Error('Row separator not found')
    const reader = rs.pipeThrough(new TextDecoderStream()).getReader()
    const pump = async (reader: ReadableStreamDefaultReader<string>): Promise<void> => await reader.read()
      .then(({ value, done }) => {
        if (done) return
        const shouldPumpingResume = this.processPump(value)
        if (!shouldPumpingResume) return
        return pump(reader)
      })
    this.isPreviousFileProcessed = pump(reader)
    await this.isPreviousFileProcessed
    this.fileParsed++
    this.rowReducer = null
    return (this.filesToParse === this.fileParsed) ? this.getData() : null
  }

  /** @returns false if pumping should be stopped in order to skip to next file */
  processPump (value: string): boolean {
    const rows = (this.lastRow + value).split('\r\n')
    const maxIndex = rows.length - 1
    let rowIndex = 0
    this.lastRow = rows[rows.length - 1]
    if (rows.length < 2) return true
    if (this.rowReducer === null) {
      const header = rows[0].split(this.rowSeparator)
      this.fileType = this.getFileType(header)
      if (this.fileType === null) return false
      this.columnsIntegrity = header.length
      this.rowReducer = this.getRowReducer(this.fileType, header)
      rowIndex++
    }
    for (let i = rowIndex; i < maxIndex; i++) {
      const columns = rows[i].split(this.rowSeparator)
      if (columns.length !== this.columnsIntegrity) throw new Error('Row integrity error')
      const reducedRow = this.rowReducer.reduce(columns)
      if (reducedRow !== null) this.rowStore.add(reducedRow)
    }
    return true
  }

  getData (): ETDInterface {
    const fileType = this.fileType
    const data = this.rowStore.data
    if (fileType === 'BeGaze Event') return new EyeTrackingParserBeGazePostprocessor().process(data)
    if (fileType === 'Tobii') return new EyeTrackingParserTobiiPostprocessor().process(data)
    throw new Error('File type for postprocessor not recognized')
  }

  getFileType (header: string[]): string | null {
    if (header.includes('RecordingTime [ms]')) return 'BeGaze Raw'
    if (header.includes('Event Start Trial Time [ms]') && header.includes('Event End Trial Time [ms]')) return 'BeGaze Event'
    if (header.includes('Recording timestamp')) return 'Tobii'
    if (header.includes('FPOGS') && header.includes('FPOGD')) return 'GazePoint' // todo: maybe incorporate filename into decision process
    return null
  }

  getRowReducer (fileType: string, row: string[]): EyeTrackingParserAbstractReducer {
    switch (fileType) {
      case 'BeGaze Raw':
        throw new Error('Support of SMI BeGaze Raw deprecated')
      case 'BeGaze Event':
        return new EyeTrackingParserBeGazeReducer(row)
      case 'Tobii':
        return new EyeTrackingParserTobiiReducer(row)
      case 'GazePoint': {
        const participant = this.currentFileName.split('_')[0]
        return new EyeTrackingParserGazePointReducer(row, participant)
      }
      default:
        throw new Error('File type row reducer not implemented')
    }
  }

  getRowSeparator (): string {
    const extension = this.currentFileName.split('.').pop()
    if (extension === 'csv') return ','
    if (extension === 'tsv') return '\t'
    throw new Error('File extension not supported')
  }
}
