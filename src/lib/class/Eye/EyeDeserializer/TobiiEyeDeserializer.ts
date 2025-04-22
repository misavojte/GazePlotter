import type { DeserializerOutputType } from '$lib/type/DeserializerOutput/DeserializerOutputType.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

// Constants for performance
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

  // Tracking state
  private currentSegment: {
    stimulus: string
    participant: string
    startTime: string
    lastTime: string
    category: string
    eyeMovementTypeIndex: string
    aoi: string[] | null
  } | null = null

  // Stimulus tracking
  private readonly stimuliBaseTimes: Map<string, string> = new Map()
  private readonly intervalStack: string[] = []
  private readonly intervalMarkers: {
    startMarker: string
    endMarker: string
  } | null = null
  private currentIntervalStimuliCache: string[] = []

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

    // Initialize interval markers if user provided them
    if (userInput !== EMPTY_STRING) {
      this.intervalMarkers = this.constructIntervalMarkers(userInput)
    }
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
   * @description Processes a single row of data, creating or updating segments as needed.
   * @param {string[]} row - Row of data.
   * @returns {DeserializerOutputType} Deserialized data if a segment is complete, null otherwise.
   */
  deserialize(row: string[]): DeserializerOutputType {
    // Skip empty rows
    if (row[this.cCategory] === EMPTY_STRING) {
      return null
    }

    const eyeMovementTypeIndex = row[this.cEyeMovementTypeIndex]
    const timestamp = row[this.cRecordingTimestamp]
    const participant = `${row[this.cRecording]} ${row[this.cParticipant]}`
    const category = row[this.cCategory]
    const aoi = this.getAoisFromRow(row)

    // Get stimulus info from the current row
    const currentRowStimulus = this.getStimulusFromRow(row)

    // Track base time for each stimulus+participant combination
    this.updateBaseTimes(currentRowStimulus, participant, timestamp)

    // First row case - initialize the first segment
    if (this.currentSegment === null) {
      if (this.isStimulusEmpty(currentRowStimulus)) {
        return null // No stimulus active, nothing to track
      }

      // Save active intervals for this segment
      if (Array.isArray(currentRowStimulus)) {
        this.currentIntervalStimuliCache = [...currentRowStimulus]
      }

      // Create the first segment
      this.currentSegment = {
        stimulus: this.getStimulusStringValue(currentRowStimulus),
        participant,
        startTime: timestamp,
        lastTime: timestamp,
        category,
        eyeMovementTypeIndex,
        aoi,
      }
      return null
    }

    // Check if eye movement type has changed - our primary segment delimiter
    if (eyeMovementTypeIndex !== this.currentSegment.eyeMovementTypeIndex) {
      // The completed segment should use its existing properties
      const completedSegment = this.createSegmentOutput(
        this.currentSegment,
        Array.isArray(currentRowStimulus) ? [] : this.intervalStack
      )

      // Start a new segment if we have an active stimulus
      if (!this.isStimulusEmpty(currentRowStimulus)) {
        // Save active intervals for the new segment
        if (Array.isArray(currentRowStimulus)) {
          this.currentIntervalStimuliCache = [...currentRowStimulus]
        }

        // Create new segment with current row data
        this.currentSegment = {
          stimulus: this.getStimulusStringValue(currentRowStimulus),
          participant,
          startTime: timestamp,
          lastTime: timestamp,
          category,
          eyeMovementTypeIndex,
          aoi,
        }
      } else {
        // No active stimulus, no segment to track
        this.currentSegment = null
        this.currentIntervalStimuliCache = []
      }

      return completedSegment
    }

    // The eye movement type hasn't changed, update the current segment
    this.currentSegment.lastTime = timestamp
    this.currentSegment.category = category
    this.currentSegment.aoi = aoi

    // Update current interval stimuli cache
    if (Array.isArray(currentRowStimulus)) {
      this.currentIntervalStimuliCache = [...currentRowStimulus]
    }

    // Stimulus has changed within the same eye movement - only update when it's valid
    const newStimulusValue = this.getStimulusStringValue(currentRowStimulus)
    if (
      newStimulusValue !== EMPTY_STRING &&
      newStimulusValue !== this.currentSegment.stimulus
    ) {
      this.currentSegment.stimulus = newStimulusValue
    }

    return null
  }

  /**
   * Updates base times for stimuli
   * @param stimulus Stimulus string or array
   * @param participant Participant identifier
   * @param timestamp Recording timestamp
   */
  private updateBaseTimes(
    stimulus: string | string[],
    participant: string,
    timestamp: string
  ): void {
    if (Array.isArray(stimulus)) {
      for (const s of stimulus) {
        const key = s + participant
        if (!this.stimuliBaseTimes.has(key)) {
          this.stimuliBaseTimes.set(key, timestamp)
        }
      }
    } else if (stimulus !== EMPTY_STRING) {
      const key = stimulus + participant
      if (!this.stimuliBaseTimes.has(key)) {
        this.stimuliBaseTimes.set(key, timestamp)
      }
    }
  }

  /**
   * Extracts stimulus information from a row, handling interval markers if present
   * @param row Data row
   * @returns Stimulus string or array of stimuli when using intervals
   */
  private getStimulusFromRow(row: string[]): string | string[] {
    // If no interval markers defined, just use the stimulus column
    if (!this.intervalMarkers) {
      return row[this.cStimulus]
    }

    const event = row[this.cEvent]
    if (!event) {
      return this.intervalStack.length > 0
        ? [...this.intervalStack]
        : EMPTY_STRING
    }

    const { startMarker, endMarker } = this.intervalMarkers

    // Handle interval start
    if (event.includes(startMarker)) {
      const newStimulus = event.replace(startMarker, '')
      if (!this.intervalStack.includes(newStimulus)) {
        this.intervalStack.push(newStimulus)
      }
      return [...this.intervalStack]
    }

    // Handle interval end
    if (event.includes(endMarker)) {
      const endingStimulus = event.replace(endMarker, '')
      const index = this.intervalStack.indexOf(endingStimulus)
      if (index !== -1) {
        this.intervalStack.splice(index, 1)
      }
      return this.intervalStack.length > 0
        ? [...this.intervalStack]
        : EMPTY_STRING
    }

    // Return current intervals
    return this.intervalStack.length > 0
      ? [...this.intervalStack]
      : EMPTY_STRING
  }

  /**
   * Check if a stimulus value is empty
   * @param stimulus The stimulus value to check
   * @returns True if stimulus is empty
   */
  private isStimulusEmpty(stimulus: string | string[]): boolean {
    return Array.isArray(stimulus)
      ? stimulus.length === 0
      : stimulus === EMPTY_STRING
  }

  /**
   * Extract a string value from a stimulus (using last item if it's an array)
   * @param stimulus Stimulus string or array
   * @returns String value of the stimulus
   */
  private getStimulusStringValue(stimulus: string | string[]): string {
    return Array.isArray(stimulus)
      ? stimulus.length > 0
        ? stimulus[stimulus.length - 1]
        : EMPTY_STRING
      : stimulus
  }

  /**
   * Creates a formatted segment output for a completed segment
   * @param segment The segment to format
   * @param activeIntervals Active intervals to use (defaults to current cache)
   * @returns Formatted segment data
   */
  private createSegmentOutput(
    segment: NonNullable<typeof this.currentSegment>,
    activeIntervals?: string[]
  ): DeserializerOutputType {
    const intervals = activeIntervals || this.currentIntervalStimuliCache

    // For interval tracking, create a segment for each active interval
    if (intervals.length > 0 && this.intervalMarkers !== null) {
      return intervals.map(stimulus => {
        const key = stimulus + segment.participant
        const baseTime = this.stimuliBaseTimes.get(key) || segment.startTime

        const startTime =
          (Number(segment.startTime) - Number(baseTime)) * TIME_MODIFIER
        const endTime =
          (Number(segment.lastTime) - Number(baseTime)) * TIME_MODIFIER

        return {
          stimulus,
          participant: segment.participant,
          start: String(startTime),
          end: String(endTime),
          category: segment.category,
          aoi: segment.aoi,
        }
      })
    }

    // Single stimulus case
    const key = segment.stimulus + segment.participant
    const baseTime = this.stimuliBaseTimes.get(key) || segment.startTime

    const startTime =
      (Number(segment.startTime) - Number(baseTime)) * TIME_MODIFIER
    const endTime =
      (Number(segment.lastTime) - Number(baseTime)) * TIME_MODIFIER

    return {
      stimulus: segment.stimulus,
      participant: segment.participant,
      start: String(startTime),
      end: String(endTime),
      category: segment.category,
      aoi: segment.aoi,
    }
  }

  /**
   * @group Deserialization
   * @description Finalizes the deserialization process.
   * @returns {DeserializerOutputType} Deserialized data.
   */
  finalize(): DeserializerOutputType {
    // Output the final segment if one exists
    if (this.currentSegment !== null) {
      return this.createSegmentOutput(this.currentSegment)
    }
    return null
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
