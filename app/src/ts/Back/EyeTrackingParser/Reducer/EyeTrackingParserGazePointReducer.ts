import { EyeTrackingParserAbstractReducer } from './EyeTrackingParserAbstractReducer'

export class EyeTrackingParserGazePointReducer extends EyeTrackingParserAbstractReducer {
  cStartOfEvent: number
  cDurationOfFixation: number
  cDurationOfBlink: number
  cAOI: number
  cStimulus: number
  mStartOfEvent: number | null = null
  mDurationOfEvent: number | null = null
  mAOI: string | null = null
  mStimulus: string | null = null
  mCategory: 'Fixation' | 'Blink' | null = null
  participant: string // for this reducer, the participant is always the same (one file per participant)
  constructor (header: string[], participant: string) {
    super()
    this.cStartOfEvent = header.indexOf('FPOGS')
    this.cDurationOfFixation = header.indexOf('FPOGD')
    this.cDurationOfBlink = header.indexOf('BKDUR')
    this.cAOI = header.indexOf('AOI')
    this.cStimulus = header.indexOf('MEDIA_NAME')
    this.participant = participant
  }

  reduce (row: string[]): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    const startOfEvent = row[this.cStartOfEvent]
    const durationOfFixation = row[this.cDurationOfFixation]
    const durationOfBlink = row[this.cDurationOfBlink]
    const aoi = row[this.cAOI]
    const stimulus = row[this.cStimulus]
    const isBlink = durationOfBlink !== '0.00000'
    const category = isBlink ? 'Fixation' : 'Blink'

    const hasFixationSegmentEnded = Number(durationOfFixation) === this.mDurationOfEvent

    let result = null

    if (this.mStimulus !== stimulus || isBlink || this.mAOI !== aoi || hasFixationSegmentEnded) {
      result = this.flush()
    }

    if ((this.mStimulus !== stimulus || isBlink || this.mAOI !== aoi) && !hasFixationSegmentEnded) {
      this.mStimulus = stimulus
      this.mAOI = aoi
      this.mCategory = category
    }

    this.mStartOfEvent = Number(startOfEvent)
    this.mDurationOfEvent = isBlink ? Number(durationOfBlink) : Number(durationOfFixation)

    return result
  }

  flush (): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    if (this.mAOI === null || this.mStimulus === null || this.mCategory === null) return null
    return {
      aoi: [this.mAOI],
      category: 'Fixation',
      end: String(Number(this.mStartOfEvent) + Number(this.mDurationOfEvent)),
      participant: this.participant,
      start: String(this.mStartOfEvent),
      stimulus: this.mStimulus
    }
  }
}
