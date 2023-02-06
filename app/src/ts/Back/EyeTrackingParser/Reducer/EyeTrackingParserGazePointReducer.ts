import { EyeTrackingParserAbstractReducer } from './EyeTrackingParserAbstractReducer'

export class EyeTrackingParserGazePointReducer extends EyeTrackingParserAbstractReducer {
  cTime: number
  cDurationOfFixation: number
  cDurationOfBlink: number
  cAOI: number
  cStimulus: number
  cFixID: number
  mTime: number | null = null
  mDurationOfEvent: number | null = null
  mDurationOfFixation: number | null = null
  mAOI: string | null = null
  mStimulus: string | null = null
  mCategory: 'Fixation' | 'Blink' | null = null
  mFixID: string | null = null
  mHasFixationSegmentEnded: boolean = false
  participant: string // for this reducer, the participant is always the same (one file per participant)
  constructor (header: string[], participant: string) {
    super()
    this.cTime = header.indexOf('FPOGS') - 1
    this.cDurationOfFixation = header.indexOf('FPOGD')
    this.cDurationOfBlink = header.indexOf('BKDUR')
    this.cAOI = header.indexOf('AOI')
    this.cStimulus = header.indexOf('MEDIA_NAME')
    this.cFixID = header.indexOf('FPOGID')
    this.participant = participant
  }

  reduce (row: string[]): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    let result = null

    const time = row[this.cTime]
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
      this.mFixID = fixID
    }
    this.mHasFixationSegmentEnded = hasFixationSegmentEnded

    return result
  }

  finalize (): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    return this.flush()
  }

  flush (): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    if (this.mStimulus === null || this.mCategory === null || this.mTime === null || this.mDurationOfEvent === null) return null
    const r = {
      aoi: this.mAOI === null ? null : [this.mAOI],
      category: this.mCategory,
      end: String(this.mTime),
      participant: this.participant,
      start: String(this.mTime - this.mDurationOfEvent),
      stimulus: this.mStimulus
    }
    this.mTime = null
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
