import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer.ts'

export class TobiiEyeDeserializer extends AbstractEyeDeserializer {
  cAoiInfo: Array<{
    columnPosition: number
    aoiName: string
    stimulusName: string
  }>
  cRecordingTimestamp: number
  cStimulus: number
  cParticipant: number
  cRecording: number
  cCategory: number
  cEvent: number
  cEyeMovementTypeIndex: number
  mStimulus = ''
  mParticipant = ''
  mRecordingStart = ''
  mEyeMovementTypeIndex = ''
  mRecordingLast = ''
  mCategory = ''
  mAoi: string[] | null = null
  mBaseTime = ''
  stimuliRevisit: Record<string, number> = {} // Using an object to track the stimulus_participant revisit count
  TIME_MODIFIER = 0.001 // milliseconds needed, tobii uses microseconds
  intervalMarkers: { start: string; end: string } | null = null
  stimulusGetter: (row: string[]) => string

  constructor(header: string[], userInput: string) {
    super()
    this.cRecordingTimestamp = header.indexOf('Recording timestamp')
    this.cStimulus = header.indexOf('Presented Stimulus name')
    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    this.cCategory = header.indexOf('Eye movement type')
    this.cEvent = header.indexOf('Event')
    this.cEyeMovementTypeIndex = header.indexOf('Eye movement type index')
    this.cAoiInfo = this.createAoiInfo(
      header,
      this.createStimuliDictionary(header)
    )
    this.stimulusGetter =
      userInput === ''
        ? this.baseStimulusGetter
        : this.getIntervalStimulusGetter(userInput)
  }

  createStimuliDictionary(header: string[]): string[] {
    const aoiColumns = header.filter(x => x.startsWith('AOI hit ['))
    return [
      ...new Set(
        aoiColumns.map(x => x.replace(/AOI hit \[|\s-.*?]/g, '')).sort()
      ),
    ]
  }

  createAoiInfo(
    header: string[],
    stimuliDictionary: string[]
  ): Array<{ columnPosition: number; aoiName: string; stimulusName: string }> {
    const aoiInfo: Array<{
      columnPosition: number
      aoiName: string
      stimulusName: string
    }> = []
    for (const stimulus of stimuliDictionary) {
      const aoiColumns = header.filter(x =>
        x.startsWith('AOI hit [' + stimulus)
      )
      const positionOfFirstColumn = header.indexOf(aoiColumns[0])
      aoiColumns.forEach((aoiItem, index) => {
        const columnPosition = positionOfFirstColumn + index
        const aoiName = aoiItem.replace(/A.*?- |]/g, '')
        aoiInfo.push({ columnPosition, aoiName, stimulusName: stimulus })
      })
    }
    return aoiInfo
  }

  deserialize(row: string[]): SingleDeserializerOutput | null {
    const category = row[this.cCategory]
    if (category === '') return null // skip empty rows

    const eyeMovementTypeIndex = row[this.cEyeMovementTypeIndex]
    const recordingTimestamp = row[this.cRecordingTimestamp]

    if (eyeMovementTypeIndex === this.mEyeMovementTypeIndex) {
      const stimulus = this.stimulusGetter(row)
      if (stimulus !== this.mStimulus && stimulus !== '') {
        this.mBaseTime = this.mRecordingStart
        const key = this.mStimulus + this.mParticipant
        if (this.mStimulus !== '') {
          this.stimuliRevisit[key] =
            this.stimuliRevisit[key] !== undefined
              ? this.stimuliRevisit[key] + 1
              : 0
        }
        this.mStimulus = stimulus
      }
      this.mRecordingLast = recordingTimestamp
      return null
    } // if not a new segment, return null immediately

    this.mEyeMovementTypeIndex = eyeMovementTypeIndex

    const previousSegment = this.getPreviousSegment()

    const stimulus = this.stimulusGetter(row)
    const participant = row[this.cRecording] + '_' + row[this.cParticipant]
    // const category = row[this.cCategory]
    const aoi = this.getAoisFromRow(row)

    // change base time if change of stimulus / participant
    if (
      stimulus !== this.mStimulus ||
      participant !== this.mParticipant ||
      this.mBaseTime === ''
    ) {
      this.mBaseTime = recordingTimestamp
      const key = this.mStimulus + this.mParticipant
      if (this.mStimulus !== '') {
        this.stimuliRevisit[key] =
          this.stimuliRevisit[key] !== undefined
            ? this.stimuliRevisit[key] + 1
            : 0
      }
      this.mStimulus = stimulus
    }

    // save newly began segment
    this.mParticipant = participant
    this.mStimulus = stimulus
    this.mRecordingStart = recordingTimestamp
    this.mCategory = category
    this.mAoi = aoi
    this.mRecordingLast = recordingTimestamp

    return previousSegment
  }

  finalize(): SingleDeserializerOutput | null {
    return this.getPreviousSegment()
  }

  getPreviousSegment(): SingleDeserializerOutput | null {
    if (
      this.mParticipant === '' ||
      this.mStimulus === '' ||
      this.mRecordingStart === '' ||
      this.mRecordingLast === this.mRecordingStart
    )
      return null
    return {
      stimulus: this.getNonDuplicateStimulus(this.mStimulus),
      participant: this.mParticipant,
      start: String(
        (Number(this.mRecordingStart) - Number(this.mBaseTime)) *
          this.TIME_MODIFIER
      ),
      end: String(
        (Number(this.mRecordingLast) - Number(this.mBaseTime)) *
          this.TIME_MODIFIER
      ),
      category: this.mCategory,
      aoi: this.mAoi,
    }
  }

  getAoisFromRow(row: string[]): string[] {
    const aois: string[] = []
    for (const aoiInfo of this.cAoiInfo) {
      if (row[aoiInfo.columnPosition] === '1') {
        aois.push(aoiInfo.aoiName)
      }
    }
    return aois
  }

  baseStimulusGetter(row: string[]): string {
    return row[this.cStimulus]
  }

  getIntervalStimulusGetter(userInput: string): (row: string[]) => string {
    const { startMarker, endMarker } = this.getIntervalMarkers(userInput)
    const stimulusGetterFunction = (row: string[]): string => {
      // there is now start of nes stimulus indicated in Event column by value in this format:
      // "NAME_OF_STIMULUS IntervalStart"
      const event = row[this.cEvent]
      // if contains IntervalStart, then it is the start of a new stimulus
      let stimulus = this.mStimulus
      if (event === '' || event === undefined) return stimulus
      if (event.includes(startMarker)) {
        stimulus = event.replace(startMarker, '')
      }
      if (event.includes(endMarker)) {
        stimulus = ''
      }
      return stimulus
    }
    return stimulusGetterFunction
  }

  getNonDuplicateStimulus(stimulus: string): string {
    if (stimulus !== '') {
      const participantKey = stimulus + this.mParticipant
      if (participantKey in this.stimuliRevisit) {
        stimulus =
          stimulus + ' (' + String(this.stimuliRevisit[participantKey]) + ')'
      }
    }
    return stimulus
  }

  getIntervalMarkers(userInput: string): {
    startMarker: string
    endMarker: string
  } {
    const markers = userInput.split(';')
    if (markers.length !== 2) {
      throw new Error('Invalid interval markers')
    }
    return { startMarker: markers[0], endMarker: markers[1] }
  }
}
