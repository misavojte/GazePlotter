import { ETDInterface } from '../../Data/EyeTrackingData'
import { EyeTrackingParserAbstractReducer } from './Reducer/EyeTrackingParserAbstractReducer'
import { EyeTrackingParserRowStore } from './EyeTrackingParserRowStore'
import { EyeTrackingParserBeGazeReducer } from './Reducer/EyeTrackingParserBeGazeReducer'
import { EyeTrackingParserTobiiReducer } from './Reducer/EyeTrackingParserTobiiReducer'
import { EyeTrackingParserBeGazePostprocessor } from './Postprocessor/EyeTrackingParserBeGazePostprocessor'
import { EyeTrackingParserTobiiPostprocessor } from './Postprocessor/EyeTrackingParserTobiiPostprocessor'
import { EyeTrackingParserGazePointReducer } from './Reducer/EyeTrackingParserGazePointReducer'
import { WorkerSettingsMessage } from '../../Types/Parsing/WorkerSettingsMessage'
import { EyeTrackingFileType } from '../../Types/Parsing/FileTypes'
import { EyeTrackingParserGazePointPostprocessor } from './Postprocessor/EyeTrackingParserGazePointPostprocessor'
import { ReducerOutputType } from '../../Types/Parsing/ReducerOutputType'

export class EyeTrackingParser {
  lastRow: string = ''
  columnsIntegrity: number = 0 // for rows integrity check
  fileNames: string[]
  fileParsed: number = 0
  columnDelimiter: string
  rowDelimiter: string
  type: EyeTrackingFileType
  userInputSettings: string | null
  rowReducer: EyeTrackingParserAbstractReducer | null = null
  rowStore: EyeTrackingParserRowStore = new EyeTrackingParserRowStore()
  isPreviousFileProcessed: Promise<void> = Promise.resolve()
  get filesToParse (): number { return this.fileNames.length }
  get currentFileName (): string { return this.fileNames[this.fileParsed] }

  constructor (settings: WorkerSettingsMessage) {
    this.fileNames = settings.fileNames
    this.rowDelimiter = settings.rowDelimiter
    this.columnDelimiter = settings.columnDelimiter
    this.type = settings.type
    this.userInputSettings = settings.userInputSetting
  }

  async process (rs: ReadableStream): Promise<ETDInterface | null> {
    const reader = rs.pipeThrough(new TextDecoderStream()).getReader()
    const pump = async (reader: ReadableStreamDefaultReader<string>): Promise<void> => await reader.read()
      .then(({ value, done }) => {
        if (done) {
          if (this.rowReducer !== null) {
            if (this.lastRow.length > 0) this.processRow(this.lastRow, this.rowReducer) // if not empty
            this.processReduced(this.rowReducer.finalize())
          } else {
            console.warn('Empty file', this.currentFileName)
          }
          this.lastRow = ''
          this.rowReducer = null
          this.fileParsed++
          return
        }
        const shouldPumpingResume = this.processPump(value)
        if (!shouldPumpingResume) return
        return pump(reader)
      })
    await pump(reader)
    this.isPreviousFileProcessed = Promise.resolve()
    return (this.filesToParse === this.fileParsed) ? this.getData() : null
  }

  /** @returns false if pumping should be stopped in order to skip to next file */
  processPump (value: string): boolean {
    const rows = (this.lastRow + value).split(this.rowDelimiter)
    const maxIndex = rows.length - 1
    let rowIndex = this.type === 'ogama' ? 8 : 0
    this.lastRow = rows[rows.length - 1]
    if (rows.length < 2) return true
    if (this.rowReducer === null) {
      const header = rows[rowIndex].split(this.columnDelimiter)
      this.columnsIntegrity = header.length
      this.rowReducer = this.getRowReducer(header)
      rowIndex++
    }
    for (let i = rowIndex; i < maxIndex; i++) {
      this.processRow(rows[i], this.rowReducer)
    }
    return true
  }

  getData (): ETDInterface {
    const fileType = this.type
    const data = this.rowStore.data
    if (fileType === 'begaze') return new EyeTrackingParserBeGazePostprocessor().process(data)
    if (fileType === 'tobii' || fileType === 'tobii-with-event') return new EyeTrackingParserTobiiPostprocessor().process(data)
    if (fileType === 'gazepoint') return new EyeTrackingParserGazePointPostprocessor().process(data)
    throw new Error('File type for postprocessor not recognized')
  }

  getRowReducer (row: string[]): EyeTrackingParserAbstractReducer {
    switch (this.type) {
      case 'begaze':
        return new EyeTrackingParserBeGazeReducer(row)
      case 'tobii':
        return this.getTobiiReducer(row, false)
      case 'tobii-with-event':
        return this.getTobiiReducer(row, true)
      case 'gazepoint': {
        const participant = this.currentFileName.split('_')[0]
        return new EyeTrackingParserGazePointReducer(row, participant)
      }
      default:
        throw new Error('File type row reducer not implemented')
    }
  }

  getTobiiReducer (row: string[], expectUserSettings: boolean): EyeTrackingParserTobiiReducer {
    const userInputSettings = this.userInputSettings
    if (expectUserSettings && userInputSettings === null) throw new Error('User input settings not set')
    const parseThroughInterval = userInputSettings === 'event'
    return new EyeTrackingParserTobiiReducer(row, parseThroughInterval)
  }

  processRow (row: string, reducer: EyeTrackingParserAbstractReducer): void {
    const columns = row.split(this.columnDelimiter)
    if (columns.length !== this.columnsIntegrity) {
      throw new Error('Row integrity error')
    }
    this.processReduced(reducer.reduce(columns))
  }

  processReduced (reducedRow: ReducerOutputType): void {
    if (Array.isArray(reducedRow)) {
      reducedRow.forEach(row => this.rowStore.add(row))
      return
    }
    if (reducedRow !== null) this.rowStore.add(reducedRow)
  }
}
