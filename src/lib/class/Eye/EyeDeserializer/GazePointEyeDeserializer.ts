import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer.ts'

export class GazePointEyeDeserializer extends AbstractEyeDeserializer {
  cStart: number
  cTime: number
  cDurationOfFixation: number
  cDurationOfBlink: number
  cAOI: number
  cStimulus: number
  cFixID: number
  mTime: number | null = null
  mStart: number | null = null
  mDurationOfEvent: number | null = null
  mDurationOfFixation: number | null = null
  mAOI: string | null = null
  mStimulus: string | null = null
  mCategory: 'Fixation' | 'Blink' | null = null
  mFixID: string | null = null
  mHasFixationSegmentEnded: boolean = false
  participant: string // for this reducer, the participant is always the same (one file per participant)
  constructor (header: string[], fileName: string) {
    super()
    this.cStart = header.indexOf('FPOGS')
    this.cTime = header.indexOf('FPOGS') - 1
    this.cDurationOfFixation = header.indexOf('FPOGD')
    this.cDurationOfBlink = header.indexOf('BKDUR')
    this.cAOI = header.indexOf('AOI')
    this.cStimulus = header.indexOf('MEDIA_NAME')
    this.cFixID = header.indexOf('FPOGID')
    this.participant = fileName.split('_')[0]
  }

  deserialize (row: string[]): SingleDeserializerOutput | null {
    let result = null

    const time = row[this.cTime]
    const start = row[this.cStart]
    const durationOfFixation = row[this.cDurationOfFixation]
    const durationOfBlink = row[this.cDurationOfBlink]
    const aoi = row[this.cAOI] === '' ? null : row[this.cAOI]
    const stimulus = row[this.cStimulus]
    const fixID = row[this.cFixID]

    const isBlink = durationOfBlink !== '0.00000'
    const category = isBlink ? 'Blink' : 'Fixation'

    const hasFixationSegmentEnded = Number(durationOfFixation) === this.mDurationOfEvent

    const isToFlush = this.mStimulus !== stimulus || this.mFixID !== fixID || this.mCategory === 'Blink' || (hasFixationSegmentEnded && !this.mHasFixationSegmentEnded)

    if (isToFlush) {
      result = this.flush()
    }

    if (this.mDurationOfFixation !== Number(durationOfFixation) || this.mStimulus !== stimulus || this.mFixID !== fixID || isBlink) {
      this.mStimulus = stimulus
      this.mAOI = aoi
      this.mCategory = category
      this.mDurationOfEvent = isBlink ? Number(durationOfBlink) : Number(durationOfFixation)
      this.mDurationOfFixation = Number(durationOfFixation)
      this.mTime = Number(time)
      this.mStart = isBlink ? Number(time) - this.mDurationOfEvent : Number(start)
      this.mFixID = fixID
    }
    this.mHasFixationSegmentEnded = hasFixationSegmentEnded

    return result
  }

  finalize (): SingleDeserializerOutput | null {
    return this.flush()
  }

  flush (): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    if (this.mStimulus === null || this.mCategory === null || this.mStart === null || this.mDurationOfEvent === null) return null
    let r: EyeTrackingParserGazePointReducerResult | null = {
      aoi: this.mAOI === null ? null : [this.mAOI],
      category: this.mCategory,
      end: String(this.mTime),
      participant: this.participant,
      start: String(this.mStart),
      stimulus: this.mStimulus
    }
    if (this.mStart === 0 && this.mTime === 0) {
      console.warn('start and end are 0 - Probable blink issue', this.mFixID, this.mStimulus, this.participant)
      r = null
    }
    this.mTime = null
    this.mStart = null
    return r
  }
}

// const hasFixationSegmentEnded = Number(durationOfFixation) === this.mDurationOfEvent
//
// const isToFlush = this.mStimulus !== stimulus || this.mFixID !== fixID || this.mCategory === 'Blink' || (hasFixationSegmentEnded && !this.mHasFixationSegmentEnded)
//
// if (isToFlush) {
//   result = this.flush()
// }

// if (isBlink || !hasFixationSegmentEnded || this.mStimulus !== stimulus || this.mFixID !== fixID) {
//   this.mStimulus = stimulus
//   this.mAOI = aoi
//   this.mCategory = category
//   this.mDurationOfEvent = isBlink ? Number(durationOfBlink) : Number(durationOfFixation)
//   this.mTime = Number(time)
//   this.mFixID = fixID
// }
// this.mHasFixationSegmentEnded = hasFixationSegmentEnded
//
// return result

interface EyeTrackingParserGazePointReducerResult {
  aoi: string[] | null
  category: 'Fixation' | 'Blink'
  end: string
  participant: string
  start: string
  stimulus: string
}
