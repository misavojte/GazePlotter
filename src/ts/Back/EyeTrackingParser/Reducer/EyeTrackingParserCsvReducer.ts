import { EyeTrackingParserAbstractReducer } from './EyeTrackingParserAbstractReducer'
import { ReducerSingleOutputType } from '../../../Types/Parsing/ReducerOutputType'

// BEWARE! If only one timestamp for whole segment, start and end are the same!
export class EyeTrackingParserCsvReducer extends EyeTrackingParserAbstractReducer {
  cTime: number
  cParticipant: number
  cStimulus: number
  cAoi: number
  mTimeStart: string = ''
  mTimeLast: string = ''
  mTimeBase: number | null = null
  mAoi: string | null = null
  mParticipant: string = 'CsvParticipant'
  mStimulus: string = 'CsvFile'
  constructor (header: string[]) {
    super()
    this.cTime = this.getIndex(header, 'Time')
    this.cAoi = this.getIndex(header, 'AOI')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cStimulus = this.getIndex(header, 'Stimulus')
  }

  reduce (row: string[]): ReducerSingleOutputType | null {
    const time = row[this.cTime]
    const aoi = row[this.cAoi]
    const participant = row[this.cParticipant]
    const stimulus = row[this.cStimulus]

    const isNewSegment = (aoi !== this.mAoi) || (participant !== this.mParticipant) || (stimulus !== this.mStimulus)
    const isNewTimebase = (this.mTimeBase === null) || (participant !== this.mParticipant) || (stimulus !== this.mStimulus)

    let output: ReducerSingleOutputType | null = null

    if (isNewTimebase) this.mTimeBase = Number(time)
    if (isNewSegment) {
      output = this.finalize()
      this.mTimeStart = time // if a new segment starts, set the start time
      this.mAoi = aoi
      this.mParticipant = participant
      this.mStimulus = stimulus
    }
    this.mTimeLast = time
    return output
  }

  finalize (): ReducerSingleOutputType | null {
    const baseTime = this.mTimeBase
    if (baseTime === null) throw new Error('Base time is null')
    const aoi = this.mAoi
    if (aoi === null) return null
    console.log({
      aoi: aoi === '' ? null : [aoi],
      category: 'Fixation', // Not really, but for now let's assume that all the data is fixations
      start: String(Number(this.mTimeStart) - baseTime),
      end: String(Number(this.mTimeLast) - baseTime),
      participant: this.mParticipant,
      stimulus: this.mStimulus
    })
    return {
      aoi: aoi === '' ? null : [aoi],
      category: 'Fixation', // Not really, but for now let's assume that all the data is fixations
      start: String(Number(this.mTimeStart) - baseTime),
      end: String(Number(this.mTimeLast) - baseTime),
      participant: this.mParticipant,
      stimulus: this.mStimulus
    }
  }
}
