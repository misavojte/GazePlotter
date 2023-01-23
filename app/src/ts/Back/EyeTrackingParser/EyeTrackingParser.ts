import { ETDInterface } from '../../Data/EyeTrackingData'
import { EyeTrackingParserAbstractReducer } from './Reducer/EyeTrackingParserAbstractReducer'
import { EyeTrackingParserRowStore } from './EyeTrackingParserRowStore'
import { EyeTrackingParserBeGazeReducer } from './Reducer/EyeTrackingParserBeGazeReducer'
import { EyeTrackingParserTobiiReducer } from './Reducer/EyeTrackingParserTobiiReducer'
import { EyeTrackingParserBeGazePostprocessor } from './Postprocessor/EyeTrackingParserBeGazePostprocessor'

export class EyeTrackingParser {
  lastRow: string = ''
  rowIndex: number = 0
  filesToParse: number = 0
  fileParsed: number = 0
  rowSeparator: string = '\t'
  rowReducer: EyeTrackingParserAbstractReducer | null = null
  rowStore: EyeTrackingParserRowStore = new EyeTrackingParserRowStore()
  isPreviousFileProcessed: Promise<void> = Promise.resolve()

  async process (rs: ReadableStream): Promise<ETDInterface | null> {
    if (this.filesToParse === 0) throw new Error('Number of files to parse was not set')
    await this.isPreviousFileProcessed
    const reader = rs.pipeThrough(new TextDecoderStream()).getReader()
    const pump = async (reader: ReadableStreamDefaultReader<string>): Promise<void> => await reader.read()
      .then(({ value, done }) => {
        if (done) return
        this.processPump(value)
        return pump(reader)
      })
    this.isPreviousFileProcessed = pump(reader)
    await this.isPreviousFileProcessed
    this.fileParsed++
    this.rowReducer = null
    console.log(this.filesToParse, this.fileParsed)
    return (this.filesToParse === this.fileParsed) ? this.getData() : null
  }

  processPump (value: string): void {
    const rows = (this.lastRow + value).split('\r\n')
    this.lastRow = rows[rows.length - 1]
    if (rows.length < 2) return
    if (this.rowReducer === null) {
      const header = rows[0].split(this.rowSeparator)
      const fileType = this.getFileType(header)
      this.rowReducer = this.getRowReducer(fileType, header)
      this.rowIndex++
    }
    for (let i = this.rowIndex; i < rows.length; i++) {
      const reducedRow = this.rowReducer.reduce(rows[i].split(this.rowSeparator))
      if (reducedRow !== null) this.rowStore.add(reducedRow)
    }
  }

  getData (): ETDInterface {
    // TODO: PŘEDĚLAT
    return new EyeTrackingParserBeGazePostprocessor().process(this.rowStore.data)
  }

  getFileType (header: string[]): string {
    if (header.includes('RecordingTime [ms]')) return 'BeGaze Raw'
    if (header.includes('Event Start Trial Time [ms]') && header.includes('Event End Trial Time [ms]')) return 'BeGaze Event'
    if (header.includes('Recording timestamp')) return 'Tobii'
    throw new Error('File type not recognized')
  }

  getRowReducer (fileType: string, row: string[]): EyeTrackingParserAbstractReducer {
    switch (fileType) {
      case 'BeGaze Raw':
        throw new Error('Support of SMI BeGaze Raw deprecated')
      case 'BeGaze Event':
        return new EyeTrackingParserBeGazeReducer(row)
      case 'Tobii':
        return new EyeTrackingParserTobiiReducer(row)
      default:
        throw new Error('File type row reducer not implemented')
    }
  }
}
