import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import type { DeserializerOutputType } from '$lib/type/DeserializerOutput/DeserializerOutputType.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

/**
 * Deserializer for Tobii eyetracking files.
 * @extends AbstractEyeDeserializer
 * @category Eye
 * @subcategory Deserializer
 * @member cAoiInfo - Array of objects containing information about AOI columns. It's being iterated over to find active AOIs, so Array > Map here.
 * @member cRecordingTimestamp - Index of the Recording timestamp column.
 * @member cStimulus - Index of the Presented Stimulus name column.
 * @member cParticipant - Index of the Participant name column.
 * @member cRecording - Index of the Recording name column.
 * @member cCategory - Index of the Eye movement type column.
 * @member cEvent - Index of the Event column.
 * @member cEyeMovementTypeIndex - Index of the Eye movement type index column.
 * @member mStimulus - Current stimulus name.
 * @member mParticipant - Current participant name.
 * @member mRecordingStart - Current recording start timestamp.
 * @member mEyeMovementTypeIndex - Current eye movement type index.
 * @member mRecordingLast - Current recording last timestamp.
 * @member mCategory - Current eye movement type.
 * @member mAoi - Current AOIs.
 * @member mBaseTime - Current base time.
 * @member stimuliRevisit - Object containing information about revisited stimuli.
 * @member stimulusGetter - Function that returns the stimulus name, either from the Presented Stimulus name column or from the Event column.
 * @member intervalStack - Stack of active intervals for nested interval handling.
 */
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
  /* stimuliRevisit: Record<string, number> = {} // Using an object to track the stimulus_participant revisit count */
  stimulusGetter: (row: string[]) => string | string[]
  stimuliBaseTimes: Map<string, string> = new Map()
  intervalStack: string[] = []

  static readonly TYPE = 'tobii'
  static readonly TIME_MODIFIER = 0.001 // microseconds to milliseconds

  /**
   * @group Initialization
   * @description Initializes the deserializer with headers and user input.
   * @param {string[]} header - Array of header names.
   * @param {string} userInput - User-defined input for interval markers.
   */
  constructor(header: string[], userInput: string) {
    super()
    this.cRecordingTimestamp = header.indexOf('Recording timestamp')
    this.cStimulus = header.indexOf('Presented Stimulus name')
    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    this.cCategory = header.indexOf('Eye movement type')
    this.cEvent = header.indexOf('Event')
    this.cEyeMovementTypeIndex = header.indexOf('Eye movement type index')
    this.cAoiInfo = this.constructAoiMapping(
      header,
      this.constructStimuliDictionary(header)
    )
    this.stimulusGetter =
      userInput === ''
        ? this.constructBaseStimulusGetter()
        : this.constructIntervalStimulusGetter(userInput)
  }

  /**
   * @group Initialization
   * @description Creates a dictionary of stimuli from the header. Specifically, it looks for columns starting with 'AOI hit [STIMULUS_NAME' and extracts the stimulus name.
   * @param {string[]} header - Array of header names.
   * @returns {string[]} Array of unique stimuli names based on AOI hit columns.
   */
  constructStimuliDictionary(header: string[]): string[] {
    const aoiColumns = header.filter(x => x.startsWith('AOI hit ['))
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
   * @returns {Array<{ columnPosition: number; aoiName: string; stimulusName: string }>} Array of objects containing information about AOI columns.
   * @example [{ columnPosition: 5, aoiName: 'AOI_1', stimulusName: 'Stimulus_1' }]
   */
  constructAoiMapping(
    header: string[],
    stimuliDictionary: string[]
  ): Array<{ columnPosition: number; aoiName: string; stimulusName: string }> {
    return stimuliDictionary.flatMap(stimulus => {
      return header
        .filter(x => x.startsWith(`AOI hit [${stimulus}`))
        .map(aoiItem => ({
          columnPosition: header.indexOf(aoiItem),
          aoiName: aoiItem.replace(/A.*?- |]/g, ''),
          stimulusName: stimulus,
        }))
    })
  }

  /**
   * @group StimulusGetterInitialization
   * @description Creates a function that returns the stimulus name from the Presented Stimulus name column.
   * @returns {(row: string[]) => string} Function that returns the stimulus name from the Presented Stimulus name column.
   * @example (row: string[]) => row[5]
   */
  constructBaseStimulusGetter(): (row: string[]) => string {
    const stimulusGetterFunction = (row: string[]): string => {
      return row[this.cStimulus]
    }
    return stimulusGetterFunction
  }

  /**
   * @group StimulusGetterInitialization
   * @description Creates a function that returns the stimulus name based on interval information in the Event column.
   * @param {string} userInput - User-defined input for interval markers.
   * @returns {(row: string[]) => string | string[]} Function that returns the stimulus name or array of stimuli based on the Event column.
   */
  constructIntervalStimulusGetter(
    userInput: string
  ): (row: string[]) => string | string[] {
    const { startMarker, endMarker } = this.constructIntervalMarkers(userInput)
    const stimulusGetterFunction = (row: string[]): string | string[] => {
      const event = row[this.cEvent]

      // If event is empty or undefined, return current stimuli stack
      if (event === '' || event === undefined) {
        return this.intervalStack.length > 0
          ? this.intervalStack[this.intervalStack.length - 1]
          : ''
      }

      // Handle interval start - add to stack
      if (event.includes(startMarker)) {
        const newStimulus = event.replace(startMarker, '')
        this.intervalStack.push(newStimulus)
        return this.intervalStack.length > 1
          ? this.intervalStack.slice()
          : newStimulus
      }

      // Handle interval end - remove from stack
      if (event.includes(endMarker)) {
        if (this.intervalStack.length > 0) {
          this.intervalStack.pop()
        }
        return this.intervalStack.length > 0 ? this.intervalStack.slice() : ''
      }

      // Return current stimulus if no interval changes
      return this.intervalStack.length > 0
        ? this.intervalStack[this.intervalStack.length - 1]
        : ''
    }
    return stimulusGetterFunction
  }

  /**
   * @group StimulusGetterInitialization
   * @description Extracts interval markers from user input to be used in the Event column for stimulus name extraction.
   * @param {string} userInput - User-defined input for interval markers.
   * @returns {{ startMarker: string; endMarker: string }} Object containing start and end interval markers.
   * @example { startMarker: ' IntervalStart', endMarker: ' IntervalEnd' }
   * @throws {Error} Throws an error if the user input does not contain exactly two interval markers.
   */
  constructIntervalMarkers(userInput: string): {
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
    if (this.isEmptyRow(row)) return null // skip empty rows
    if (this.isSameSegment(row)) return this.deserializeSameSegment(row)
    return this.deserializeNewSegment(row)
  }

  /**
   * @group Deserialization
   * @description Deserializes a row of data that belongs to the same segment as the previous row. Always returns null. Saves the last timestamp of the segment to be used in case of a new segment in the next row.
   * @param {string[]} row - Row of data.
   * @returns {null} Always returns null.
   */
  deserializeSameSegment(row: string[]): null {
    this.mRecordingLast = row[this.cRecordingTimestamp]
    return null
  }

  /**
   * @group Deserialization
   * @description Deserializes a row of data that belongs to a new segment. Releases the previous segment and starts a new one.
   * @param {string[]} row - Row of data.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  deserializeNewSegment(row: string[]): DeserializerOutputType {
    const eyeMovementTypeIndex = row[this.cEyeMovementTypeIndex]
    const recordingTimestamp = row[this.cRecordingTimestamp]

    this.mEyeMovementTypeIndex = eyeMovementTypeIndex

    const previousSegment = this.getPreviousSegment()

    const stimulusResult = this.stimulusGetter(row)

    // Handle multiple stimuli (stacked intervals)
    if (Array.isArray(stimulusResult)) {
      // Create a segment for each stimulus in the stack if this is a stack change
      const participant = row[this.cRecording] + ' ' + row[this.cParticipant]
      const category = row[this.cCategory]
      const aoi = this.getAoisFromRow(row)

      // Update current state
      this.mParticipant = participant
      this.mRecordingStart = recordingTimestamp
      this.mCategory = category
      this.mAoi = aoi
      this.mRecordingLast = recordingTimestamp

      // Set the current stimulus to the most recent one in the stack
      this.mStimulus = stimulusResult[stimulusResult.length - 1]

      // For each stimulus in the stack, ensure it has a base time
      stimulusResult.forEach(stimulus => {
        if (this.stimuliBaseTimes.get(stimulus + participant) === undefined) {
          this.stimuliBaseTimes.set(stimulus + participant, recordingTimestamp)
        }
      })

      // If there's a previous segment and we have multiple stimuli, create multiple outputs
      if (previousSegment) {
        // If previousSegment is an array, return it; otherwise, return previous as is
        return previousSegment
      }
      return null
    } else {
      // Original single stimulus behavior
      const stimulus = stimulusResult as string
      const participant = row[this.cRecording] + ' ' + row[this.cParticipant]
      const aoi = this.getAoisFromRow(row)

      if (this.stimuliBaseTimes.get(stimulus + participant) === undefined) {
        this.stimuliBaseTimes.set(stimulus + participant, recordingTimestamp)
      }

      // save newly began segment
      this.mParticipant = participant
      this.mStimulus = stimulus
      this.mRecordingStart = recordingTimestamp
      this.mCategory = row[this.cCategory]
      this.mAoi = aoi
      this.mRecordingLast = recordingTimestamp
      return previousSegment
    }
  }

  /**
   * @group Deserialization
   * @description Checks if a row is empty based on the Category column.
   * @param {string[]} row - Row of data.
   * @returns {boolean} True if the row is empty, false otherwise.
   */
  isEmptyRow = (row: string[]): boolean => {
    return row[this.cCategory] === ''
  }

  /**
   * @group Deserialization
   * @description Checks if a row is still part of the same segment as the previous row.
   * @param {string[]} row - Row of data.
   * @returns {boolean} True if the row is part of the same segment, false otherwise.
   */
  isSameSegment(row: string[]): boolean {
    return row[this.cEyeMovementTypeIndex] === this.mEyeMovementTypeIndex
  }

  /**
   * @group Deserialization
   * @description Finalizes the deserialization process. Releases the last segment. Used when there is no more data to deserialize.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  finalize(): DeserializerOutputType {
    return this.getPreviousSegment()
  }

  /**
   * @group Deserialization
   * @description Releases the last segment. Used either when there is no more data to deserialize or when a new segment is encountered.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  getPreviousSegment(): DeserializerOutputType {
    if (
      this.mParticipant === '' ||
      this.mStimulus === '' ||
      this.mRecordingStart === '' ||
      this.mRecordingLast === this.mRecordingStart
    )
      return null

    // If we have an interval stack, create a segment for each interval
    if (this.intervalStack.length > 1) {
      // Create a unique set of stimulus names to avoid duplicates
      const uniqueStimuli = [...new Set(this.intervalStack)]

      return uniqueStimuli.map(stimulus => {
        const baseTime =
          this.stimuliBaseTimes.get(stimulus + this.mParticipant) ||
          this.mRecordingStart

        return {
          stimulus: stimulus,
          participant: this.mParticipant,
          start: String(
            (Number(this.mRecordingStart) - Number(baseTime)) *
              TobiiEyeDeserializer.TIME_MODIFIER
          ),
          end: String(
            (Number(this.mRecordingLast) - Number(baseTime)) *
              TobiiEyeDeserializer.TIME_MODIFIER
          ),
          category: this.mCategory,
          aoi: this.mAoi,
        }
      })
    } else {
      // Original single stimulus behavior
      const baseTime = this.stimuliBaseTimes.get(
        this.mStimulus + this.mParticipant
      )

      return {
        stimulus: this.mStimulus,
        participant: this.mParticipant,
        start: String(
          (Number(this.mRecordingStart) - Number(baseTime)) *
            TobiiEyeDeserializer.TIME_MODIFIER
        ),
        end: String(
          (Number(this.mRecordingLast) - Number(baseTime)) *
            TobiiEyeDeserializer.TIME_MODIFIER
        ),
        category: this.mCategory,
        aoi: this.mAoi,
      }
    }
  }

  /**
   * @group Deserialization
   * @description Extracts AOIs from a row of data. Iterates over the array of AOI information objects to find active AOIs.
   * @param {string[]} row - Row of data.
   * @returns {string[]} Array of AOIs.
   * @example ['AOI_1', 'AOI_2']
   */
  getAoisFromRow(row: string[]): string[] {
    return this.cAoiInfo
      .filter(aoiInfo => row[aoiInfo.columnPosition] === '1')
      .map(aoiInfo => aoiInfo.aoiName)
  }

  /**
   * @group Deserialization
   * @description Returns the stimulus name from the Event column.
   * @param {string[]} row - Row of data.
   * @returns {string} Stimulus name.
   */
  /*getNonDuplicateStimulus(stimulus: string): string {
    if (stimulus !== '') {
      const participantKey = stimulus + this.mParticipant
      if (participantKey in this.stimuliRevisit) {
        stimulus =
          stimulus + ' (' + String(this.stimuliRevisit[participantKey]) + ')'
      }
    }
    return stimulus
  }*/
}
