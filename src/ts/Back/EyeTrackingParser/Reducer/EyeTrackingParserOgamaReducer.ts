import { EyeTrackingParserAbstractReducer } from './EyeTrackingParserAbstractReducer'
import { ReducerSingleOutputType } from '../../../Types/Parsing/ReducerOutputType'

export class EyeTrackingParserOgamaReducer extends EyeTrackingParserAbstractReducer {
  stimulusName: string
  cParticipant: number
  cSegments: number
  constructor (header: string[], fileName: string) {
    super()
    // extract name from file name (SimilarityXXX.txt) where XXX is the stimulus name
    // this.stimulusName = fileName.split('.')[0].split('Similarity')[1]
    this.stimulusName = fileName.split('.')[0]
    this.cParticipant = this.getIndex(header, 'Sequence Similarity')
    this.cSegments = this.getIndex(header, 'Scanpath string')
  }

  finalize (): null {
    return null
  }

  reduce (row: string[]): ReducerSingleOutputType[] {
    const segments = row[this.cSegments] // just letters - each one fixation
    const participant = row[this.cParticipant]
    const result: ReducerSingleOutputType[] = []
    for (let i = 0; i < segments.length; i++) {
      const aoi = segments[i] === '#' ? null : [segments[i]]
      const start = i.toString()
      const end = (i + 1).toString()
      const category = 'Fixation'
      const stimulus = this.stimulusName
      result.push({ aoi, category, end, participant, start, stimulus })
    }
    return result
  }
}
