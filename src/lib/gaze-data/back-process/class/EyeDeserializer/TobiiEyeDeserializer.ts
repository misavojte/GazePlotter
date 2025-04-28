import type { DeserializerOutputType } from '$lib/type/DeserializerOutput/DeserializerOutputType.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

const TIME_MODIFIER = 0.001 // microseconds to milliseconds
const EMPTY_STRING = ''
const AOI_HIT_PREFIX = 'AOI hit ['

/**
 * Deserializer for Tobii eyetracking files.
 * @extends AbstractEyeDeserializer
 * @category Eye
 * @subcategory Deserializer
 */
export class TobiiEyeDeserializer extends AbstractEyeDeserializer {
  // Column indices in the data file
  private readonly cRecordingTimestamp: number
  private readonly cStimulus: number
  private readonly cParticipant: number
  private readonly cRecording: number
  private readonly cCategory: number
  private readonly cEvent: number
  private readonly cEyeMovementTypeIndex: number
  private readonly cAoiInfo: Array<{
    columnPosition: number
    aoiName: string
    stimulusName: string
  }>

  // Current segment state
  private mStimulus = EMPTY_STRING
  private mParticipant = EMPTY_STRING
  private mRecordingStart = EMPTY_STRING
  private mEyeMovementTypeIndex = EMPTY_STRING
  private mRecordingLast = EMPTY_STRING
  private mCategory = EMPTY_STRING
  private mAoi: string[] | null = null

  // Stimulus tracking
  private readonly stimulusGetter: (row: string[]) => string | string[]
  private readonly stimuliBaseTimes: Map<string, string> = new Map()
  private readonly intervalStack: string[] = []

  // Constants
  static readonly TYPE = 'tobii'

  /**
   * @group Initialization
   * @description Initializes the deserializer with headers and user input.
   * @param {string[]} header - Array of header names.
   * @param {string} userInput - User-defined input for interval markers.
   */
  constructor(header: string[], userInput: string) {
    super()
    this.cRecordingTimestamp = header.indexOf('Recording timestamp')

    const basicStimulusColumnIndex = header.indexOf('Presented Stimulus name')
    this.cStimulus =
      basicStimulusColumnIndex === -1
        ? header.indexOf('Recording media name')
        : basicStimulusColumnIndex

    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    this.cCategory = header.indexOf('Eye movement type')
    this.cEvent = header.indexOf('Event')
    this.cEyeMovementTypeIndex = header.indexOf('Eye movement type index')

    const stimuliDictionary = this.constructStimuliDictionary(header)
    this.cAoiInfo = this.constructAoiMapping(header, stimuliDictionary)

    this.stimulusGetter =
      userInput === EMPTY_STRING
        ? this.constructBaseStimulusGetter()
        : this.constructIntervalStimulusGetter(userInput)
  }

  /**
   * @group Initialization
   * @description Creates a dictionary of stimuli from the header.
   * @param {string[]} header - Array of header names.
   * @returns {string[]} Array of unique stimuli names based on AOI hit columns.
   */
  private constructStimuliDictionary(header: string[]): string[] {
    const aoiColumns = header.filter(x => x.startsWith(AOI_HIT_PREFIX))
    return [
      ...new Set(
        aoiColumns.map(x => x.replace(/AOI hit \[|\s-.*?]/g, '')).sort()
      ),
    ]
  }

  /**
   * @group Initialization
   * @description Creates an array of objects containing information about AOI columns.
   * @param {string[]} header - Array of header names.
   * @param {string[]} stimuliDictionary - Array of unique stimuli names based on AOI hit columns.
   * @returns {Array<{ columnPosition: number; aoiName: string; stimulusName: string }>} AOI column info objects.
   */
  private constructAoiMapping(
    header: string[],
    stimuliDictionary: string[]
  ): Array<{ columnPosition: number; aoiName: string; stimulusName: string }> {
    const result: Array<{
      columnPosition: number
      aoiName: string
      stimulusName: string
    }> = []

    for (const stimulus of stimuliDictionary) {
      const aoiPrefix = `${AOI_HIT_PREFIX}${stimulus}`

      for (let i = 0; i < header.length; i++) {
        const headerItem = header[i]
        if (headerItem.startsWith(aoiPrefix)) {
          result.push({
            columnPosition: i,
            aoiName: headerItem.replace(/A.*?- |]/g, ''),
            stimulusName: stimulus,
          })
        }
      }
    }

    return result
  }

  /**
   * @group StimulusGetterInitialization
   * @description Creates a function that returns the stimulus name from the Presented Stimulus name column.
   * @returns {(row: string[]) => string} Function that returns the stimulus name.
   */
  private constructBaseStimulusGetter(): (row: string[]) => string {
    return (row: string[]): string => row[this.cStimulus]
  }

  /**
   * @group StimulusGetterInitialization
   * @description Creates a function that returns the stimulus name based on interval information.
   * @param {string} userInput - User-defined input for interval markers.
   * @returns {(row: string[]) => string | string[]} Function for interval-based stimulus tracking.
   */
  private constructIntervalStimulusGetter(
    userInput: string
  ): (row: string[]) => string | string[] {
    const { startMarker, endMarker } = this.constructIntervalMarkers(userInput)

    return (row: string[]): string | string[] => {
      const event = row[this.cEvent]

      // If event is empty or undefined, return current stimuli stack
      if (!event) {
        return this.intervalStack.length > 0 ? this.intervalStack : EMPTY_STRING
      }

      // Handle interval start - add to stack if not already present
      if (event.includes(startMarker)) {
        const newStimulus = event.replace(startMarker, '')
        if (!this.intervalStack.includes(newStimulus)) {
          this.intervalStack.push(newStimulus)
        }
        return this.intervalStack
      }

      // Handle interval end - remove from stack if present
      if (event.includes(endMarker)) {
        const endingStimulus = event.replace(endMarker, '')
        const index = this.intervalStack.indexOf(endingStimulus)
        if (index !== -1) {
          this.intervalStack.splice(index, 1)
        }
        return this.intervalStack.length > 0 ? this.intervalStack : EMPTY_STRING
      }

      // Return current stimulus stack if no interval changes
      return this.intervalStack.length > 0 ? this.intervalStack : EMPTY_STRING
    }
  }

  /**
   * @group StimulusGetterInitialization
   * @description Extracts interval markers from user input.
   * @param {string} userInput - User-defined input for interval markers.
   * @returns {{ startMarker: string; endMarker: string }} Object containing start and end interval markers.
   */
  private constructIntervalMarkers(userInput: string): {
    startMarker: string
    endMarker: string
  } {
    const markers = userInput.split(';')
    if (markers.length !== 2) {
      throw new Error(
        `Invalid interval markers. Expected format: "start;end". Got: "${userInput}"`
      )
    }
    return { startMarker: markers[0], endMarker: markers[1] }
  }

  /**
   * @group Deserialization
   * @description Deserializes a row of data.
   * @param {string[]} row - Row of data.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  deserialize(row: string[]): DeserializerOutputType {
    if (this.isEmptyRow(row)) return null
    if (this.isSameSegment(row)) {
      this.mRecordingLast = row[this.cRecordingTimestamp]
      return null
    }
    return this.deserializeNewSegment(row)
  }

  /**
   * @group Deserialization
   * @description Deserializes a row from a new segment.
   * @param {string[]} row - Row of data.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  private deserializeNewSegment(row: string[]): DeserializerOutputType {
    const recordingTimestamp = row[this.cRecordingTimestamp]
    this.mEyeMovementTypeIndex = row[this.cEyeMovementTypeIndex]

    const previousSegment = this.getPreviousSegment()
    const stimulusResult = this.stimulusGetter(row)

    // Skip segment if no active stimulus
    if (
      stimulusResult === EMPTY_STRING ||
      (Array.isArray(stimulusResult) && stimulusResult.length === 0)
    ) {
      this.mStimulus = EMPTY_STRING
      return previousSegment
    }

    const participant = `${row[this.cRecording]} ${row[this.cParticipant]}`

    // Handle multiple active stimuli
    if (Array.isArray(stimulusResult) && stimulusResult.length > 0) {
      this.updateStimuliBaseTimes(
        stimulusResult,
        participant,
        recordingTimestamp
      )
      this.mStimulus = stimulusResult[stimulusResult.length - 1]
    } else {
      // Single stimulus case
      const stimulus = stimulusResult as string
      const stimulusParticipantKey = stimulus + participant

      if (!this.stimuliBaseTimes.has(stimulusParticipantKey)) {
        this.stimuliBaseTimes.set(stimulusParticipantKey, recordingTimestamp)
      }
      this.mStimulus = stimulus
    }

    // Save common segment data
    this.mParticipant = participant
    this.mRecordingStart = recordingTimestamp
    this.mCategory = row[this.cCategory]
    this.mAoi = this.getAoisFromRow(row)
    this.mRecordingLast = recordingTimestamp

    return previousSegment
  }

  /**
   * Updates base times for multiple stimuli
   * @param stimuli Array of stimulus names
   * @param participant Participant identifier
   * @param timestamp Recording timestamp
   */
  private updateStimuliBaseTimes(
    stimuli: string[],
    participant: string,
    timestamp: string
  ): void {
    for (const stimulus of stimuli) {
      const key = stimulus + participant
      if (!this.stimuliBaseTimes.has(key)) {
        this.stimuliBaseTimes.set(key, timestamp)
      }
    }
  }

  /**
   * @group Deserialization
   * @description Checks if a row is empty.
   * @param {string[]} row - Row of data.
   * @returns {boolean} True if the row is empty.
   */
  private isEmptyRow(row: string[]): boolean {
    return row[this.cCategory] === EMPTY_STRING
  }

  /**
   * @group Deserialization
   * @description Checks if a row is part of the same segment.
   * @param {string[]} row - Row of data.
   * @returns {boolean} True if the row is part of the same segment.
   */
  private isSameSegment(row: string[]): boolean {
    if (row[this.cEyeMovementTypeIndex] !== this.mEyeMovementTypeIndex) {
      return false
    }

    const stimulusResult = this.stimulusGetter(row)

    return Array.isArray(stimulusResult)
      ? stimulusResult.includes(this.mStimulus)
      : stimulusResult === this.mStimulus
  }

  /**
   * @group Deserialization
   * @description Finalizes the deserialization process.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  finalize(): DeserializerOutputType {
    return this.getPreviousSegment()
  }

  /**
   * @group Deserialization
   * @description Releases the previous segment.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  private getPreviousSegment(): DeserializerOutputType {
    // Early return if we don't have valid segment data
    if (
      this.mParticipant === EMPTY_STRING ||
      this.mStimulus === EMPTY_STRING ||
      this.mRecordingStart === EMPTY_STRING ||
      this.mRecordingLast === this.mRecordingStart
    ) {
      return null
    }

    // Handle active intervals in the stack
    if (this.intervalStack.length > 0) {
      return this.createSegmentsForIntervals()
    }

    // Handle single stimulus case
    return this.createSegmentForSingleStimulus()
  }

  /**
   * Creates segments for all active intervals
   * @returns Array of segment data for each active interval
   */
  private createSegmentsForIntervals(): DeserializerOutputType {
    return this.intervalStack.map(stimulus => {
      const participantKey = stimulus + this.mParticipant
      const baseTime =
        this.stimuliBaseTimes.get(participantKey) || this.mRecordingStart

      const startTime =
        (Number(this.mRecordingStart) - Number(baseTime)) * TIME_MODIFIER
      const endTime =
        (Number(this.mRecordingLast) - Number(baseTime)) * TIME_MODIFIER

      return {
        stimulus,
        participant: this.mParticipant,
        start: String(startTime),
        end: String(endTime),
        category: this.mCategory,
        aoi: this.mAoi,
      }
    })
  }

  /**
   * Creates a segment for a single stimulus
   * @returns Segment data for the current stimulus
   */
  private createSegmentForSingleStimulus(): DeserializerOutputType {
    const participantKey = this.mStimulus + this.mParticipant
    const baseTime =
      this.stimuliBaseTimes.get(participantKey) || this.mRecordingStart

    const startTime =
      (Number(this.mRecordingStart) - Number(baseTime)) * TIME_MODIFIER
    const endTime =
      (Number(this.mRecordingLast) - Number(baseTime)) * TIME_MODIFIER

    return {
      stimulus: this.mStimulus,
      participant: this.mParticipant,
      start: String(startTime),
      end: String(endTime),
      category: this.mCategory,
      aoi: this.mAoi,
    }
  }

  /**
   * @group Deserialization
   * @description Extracts active AOIs from a row of data.
   * @param {string[]} row - Row of data.
   * @returns {string[]} Array of active AOI names.
   */
  private getAoisFromRow(row: string[]): string[] {
    const result: string[] = []

    for (const aoiInfo of this.cAoiInfo) {
      if (row[aoiInfo.columnPosition] === '1') {
        result.push(aoiInfo.aoiName)
      }
    }

    return result
  }
}
