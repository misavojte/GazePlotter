import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

// BEWARE! If only one timestamp for whole segment, start and end are the same!
export class CsvEyeDeserializer extends AbstractEyeDeserializer {
  cTime: number
  cParticipant: number
  cStimulus: number
  cAoi: number

  private readonly pTime = 0
  private readonly pAoi = 1
  private readonly pParticipant = 2
  private readonly pStimulus = 3

  mTimeStart = ''
  mTimeLast = ''
  mTimeBase: number | null = null
  mAoi: string | null = null
  mParticipant = 'CsvParticipant'
  mStimulus = 'CsvFile'
  constructor(header: string[], columnDelimiter: string) {
    super(columnDelimiter)
    this.cTime = this.getIndex(header, 'Time')
    this.cAoi = this.getIndex(header, 'AOI')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cStimulus = this.getIndex(header, 'Stimulus')

    this.setupColumns([
      this.cTime,
      this.cAoi,
      this.cParticipant,
      this.cStimulus,
    ])
  }

  deserialize(_rawRowRef: string): SingleDeserializerOutput | null {
    const time = this.getCurr(this.pTime)
    const aoi = this.getCurr(this.pAoi)
    const participant = this.getCurr(this.pParticipant)
    const stimulus = this.getCurr(this.pStimulus)

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
