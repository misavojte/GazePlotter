import { EyeTrackingParserAbstractReducer } from './EyeTrackingParserAbstractReducer'

export class EyeTrackingParserTobiiReducer extends EyeTrackingParserAbstractReducer {
  cAoiInfo: Array<{ columnPosition: number, aoiName: string, stimulusName: string }>
  cTime: number
  cStimulus: number
  cParticipant: number
  cRecording: number
  cCategory: number
  cEvent: number
  mIsOpen: boolean = false
  mLastStimulus: string = ''
  mLastParticipant: string = ''
  mLastStartTime: number = 0
  mLastSavedTime: number = 0
  mBaseTime: number = 0
  mLastCategory: string = ''
  mLastAoi: string[] | null = null
  mLastAoiString: string = ''
  TIME_MODIFIER: number = 0.001 // milliseconds needed, tobii uses microseconds
  EVENT_START_STIMULUS: string = 'IntervalStart'
  // EVENT_END_STIMULUS: string = 'IntervalEnd'
  stimulusGetter: (row: string[]) => string

  constructor (header: string[], parseThroughIntervals: boolean = false) {
    super()
    this.cTime = header.indexOf('Recording timestamp')
    this.cStimulus = header.indexOf('Presented Stimulus name')
    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    this.cCategory = header.indexOf('Eye movement type')
    this.cEvent = header.indexOf('Event')
    this.cAoiInfo = this.createAoiInfo(header, this.createStimuliDictionary(header))
    this.stimulusGetter = parseThroughIntervals ? this.intervalStimulusGetter : this.baseStimulusGetter
  }

  createStimuliDictionary (header: string[]): string[] {
    const aoiColumns = header.filter((x) => (x.startsWith('AOI hit [')))
    return [...new Set(aoiColumns.map(x => x.replace(/AOI hit \[|\s-.*?]/g, '')).sort())]
  }

  createAoiInfo (header: string[], stimuliDictionary: string[]): Array<{ columnPosition: number, aoiName: string, stimulusName: string }> {
    const aoiInfo: Array<{ columnPosition: number, aoiName: string, stimulusName: string }> = []
    for (const stimulus of stimuliDictionary) {
      const aoiColumns = header.filter((x) => (x.startsWith('AOI hit [' + stimulus)))
      const positionOfFirstColumn = header.indexOf(aoiColumns[0])
      aoiColumns.forEach((aoiItem, index) => {
        const columnPosition = positionOfFirstColumn + index
        const aoiName = aoiItem.replace(/A.*?- |]/g, '')
        aoiInfo.push({ columnPosition, aoiName, stimulusName: stimulus })
      })
    }
    return aoiInfo
  }

  setLastValues (stimulus: string, participant: string, startTime: number, category: string, aoi: string[] | null): void {
    this.mLastStimulus = stimulus
    this.mLastParticipant = participant
    this.mLastStartTime = startTime - this.mBaseTime
    this.mLastCategory = category
    this.mLastAoi = aoi
    this.mLastAoiString = aoi === null ? '' : aoi.join(';')
    this.mIsOpen = true
  }

  reduce (row: string[]): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    let result = null
    const stimulus = this.stimulusGetter(row)
    if (stimulus === '') return null // ignore empty rows
    const time = Number(row[this.cTime])
    if (time === 0) return null
    const participant = row[this.cParticipant] + '_' + row[this.cRecording]
    const category = row[this.cCategory]
    const aois = this.getAoisFromRow(row)

    if (stimulus !== this.mLastStimulus || participant !== this.mLastParticipant) {
      result = this.getReduceDataFromMemory()
      this.mBaseTime = Number(row[this.cTime]) // set new base time
      this.setLastValues(stimulus, participant, time, category, aois)
    } else if (this.isAoiDifferent(aois) || category !== this.mLastCategory) {
      result = this.getReduceDataFromMemory()
      this.setLastValues(stimulus, participant, time, category, aois)
    }
    this.mLastSavedTime = time - this.mBaseTime
    return result
  }

  getReduceDataFromMemory (): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null {
    return this.mIsOpen
      ? {
          start: (this.mLastStartTime * this.TIME_MODIFIER).toString(),
          end: (this.mLastSavedTime * this.TIME_MODIFIER).toString(),
          stimulus: this.mLastStimulus,
          participant: this.mLastParticipant,
          category: this.mLastCategory,
          aoi: this.mLastAoi
        }
      : null
  }

  getAoisFromRow (row: string[]): string[] {
    const aois: string[] = []
    for (const aoiInfo of this.cAoiInfo) {
      if (row[aoiInfo.columnPosition] === '1') {
        aois.push(aoiInfo.aoiName)
      }
    }
    return aois
  }

  isAoiDifferent (aoi: string[] | null): boolean {
    return this.mLastAoiString !== (aoi === null ? '' : aoi.join(';'))
  }

  baseStimulusGetter (row: string[]): string {
    return row[this.cStimulus]
  }

  intervalStimulusGetter (row: string[]): string {
    // there is now start of nes stimulus indicated in Event column by value in this format:
    // "NAME_OF_STIMULUS IntervalStart"
    const event = row[this.cEvent]
    // if contains IntervalStart, then it is the start of a new stimulus
    let stimulus = this.mLastStimulus
    if (event.includes(this.EVENT_START_STIMULUS)) {
      stimulus = event.replace(' ' + this.EVENT_START_STIMULUS, '')
    }
    return stimulus
  }
}
