import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer.ts'

// BEWARE! If only one timestamp for whole segment, start and end are the same!
export class CsvEyeDeserializer extends AbstractEyeDeserializer {
  cTime: number
  cParticipant: number
  cStimulus: number
  cAoi: number
  mTimeStart = ''
  mTimeLast = ''
  mTimeBase: number | null = null
  mAoi: string | null = null
  mParticipant = 'CsvParticipant'
  mStimulus = 'CsvFile'
  constructor(header: string[]) {
    super()
    this.cTime = this.getIndex(header, 'Time')
    this.cAoi = this.getIndex(header, 'AOI')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cStimulus = this.getIndex(header, 'Stimulus')
  }

  /**
   * Deserialize a csv row into a SingleDeserializerOutput object
   * @param row is a string array with the values of the csv row
   * @returns a SingleDeserializerOutput object or null if the row is not a valid fixation
   */
  deserialize(row: string[]): SingleDeserializerOutput | null {
    const time = row[this.cTime]
    const aoi = row[this.cAoi]
    const participant = row[this.cParticipant]
    const stimulus = row[this.cStimulus]

    const isNewSegment =
      aoi !== this.mAoi ||
      participant !== this.mParticipant ||
      stimulus !== this.mStimulus
    const isNewTimebase =
      this.mTimeBase === null ||
      participant !== this.mParticipant ||
      stimulus !== this.mStimulus

    let output: SingleDeserializerOutput | null = null

    if (this.mTimeBase === null) this.mTimeBase = Number(time)
    if (isNewSegment) {
      output = this.finalize()
      this.mTimeStart = time // if a new segment starts, set the start time
      this.mAoi = aoi
      this.mParticipant = participant
      this.mStimulus = stimulus
    }
    if (isNewTimebase) this.mTimeBase = Number(time)
    this.mTimeLast = time
    return output
  }

  finalize(): SingleDeserializerOutput | null {
    const baseTime = this.mTimeBase
    if (baseTime === null) throw new Error('Base time is null')
    const aoi = this.mAoi
    if (aoi === null) return null
    return {
      aoi: aoi === '' ? null : [aoi],
      category: 'Fixation', // Not really, but for now let's assume that all the const is fixations
      start: String(Number(this.mTimeStart) - baseTime),
      end: String(Number(this.mTimeLast) - baseTime),
      participant: this.mParticipant,
      stimulus: this.mStimulus,
    }
  }
}
