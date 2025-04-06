import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

/**
 * Deserializer for GazePoint eye tracking data.
 *
 * GazePoint data format specifics:
 * - FPOGS: Start time of fixation
 * - FPOGD: Duration of fixation
 * - FPOGID: Fixation ID
 * - FPOGV: Fixation validity (1 = valid, 0 = invalid)
 * - BKDUR: Duration of blink
 */
export class GazePointEyeDeserializer extends AbstractEyeDeserializer {
  // Column indices
  cTime: number
  cStart: number
  cDurationOfFixation: number
  cDurationOfBlink: number
  cAOI: number
  cStimulus: number
  cFixID: number
  cValidity: number

  // State variables
  mCurrentFixation: {
    fixID: string
    start: number
    end: number
    aoi: string | null
    stimulus: string
    category: 'Fixation' | 'Blink'
  } | null = null

  participant: string // for this reducer, the participant is always the same (one file per participant)

  constructor(header: string[], fileName: string) {
    super()

    // Find essential columns
    this.cTime = this.findTimeColumn(header)
    this.cStart = header.indexOf('FPOGS')
    this.cDurationOfFixation = header.indexOf('FPOGD')
    this.cDurationOfBlink = header.indexOf('BKDUR')
    this.cAOI = header.indexOf('AOI')
    this.cStimulus = header.indexOf('MEDIA_NAME')
    this.cFixID = header.indexOf('FPOGID')
    this.cValidity = header.indexOf('FPOGV')

    // Extract participant ID from filename
    this.participant = fileName.split('_')[0]
  }

  /**
   * Find the time column in the header
   * GazePoint files may have different time column names
   */
  private findTimeColumn(header: string[]): number {
    // Try common time column names
    const timeIndex = header.indexOf('TIME')
    if (timeIndex !== -1) return timeIndex

    // Look for column with TIME in the name
    const timeColumnIndex = header.findIndex(col => col.includes('TIME'))
    if (timeColumnIndex !== -1) return timeColumnIndex

    // If not found, use the index before FPOGS as fallback
    return header.indexOf('FPOGS') - 1
  }

  deserialize(row: string[]): SingleDeserializerOutput | null {
    // Extract values from row
    const time = Number(row[this.cTime])
    const fixationStart = Number(row[this.cStart])
    const durationOfFixation = Number(row[this.cDurationOfFixation])
    const durationOfBlink = Number(row[this.cDurationOfBlink])
    const aoi = row[this.cAOI] === '' ? null : row[this.cAOI]
    const stimulus = row[this.cStimulus]
    const fixID = row[this.cFixID]
    const isValidFixation = row[this.cValidity] === '1'

    // Determine if this is a blink
    const isBlink = durationOfBlink > 0
    const category = isBlink ? 'Blink' : 'Fixation'

    let result: SingleDeserializerOutput | null = null

    // Case 1: We have a current fixation
    if (this.mCurrentFixation !== null) {
      const needToEndCurrentFixation =
        isBlink || // A blink always ends the current fixation
        this.mCurrentFixation.fixID !== fixID || // The fixation ID changed
        this.mCurrentFixation.stimulus !== stimulus || // The stimulus changed
        (!isValidFixation && this.mCurrentFixation.category === 'Fixation') // Fixation became invalid

      if (needToEndCurrentFixation) {
        // Flush the current fixation and return it
        result = this.flushCurrentFixation()

        // Start a new fixation if valid
        if ((isValidFixation && category === 'Fixation') || isBlink) {
          this.startNewFixation(
            fixationStart,
            time,
            durationOfFixation,
            durationOfBlink,
            aoi,
            stimulus,
            fixID,
            category
          )
        }
      } else {
        // Update the end time of the current fixation
        this.mCurrentFixation.end = time
      }
    }
    // Case 2: We don't have a current fixation
    else if ((isValidFixation && category === 'Fixation') || isBlink) {
      // Start a new fixation/blink
      this.startNewFixation(
        fixationStart,
        time,
        durationOfFixation,
        durationOfBlink,
        aoi,
        stimulus,
        fixID,
        category
      )
    }

    return result
  }

  /**
   * Start a new fixation with the given parameters
   */
  private startNewFixation(
    fixationStart: number,
    time: number,
    durationOfFixation: number,
    durationOfBlink: number,
    aoi: string | null,
    stimulus: string,
    fixID: string,
    category: 'Fixation' | 'Blink'
  ): void {
    const startTime =
      category === 'Blink'
        ? time - durationOfBlink // For blinks, calculate start time from current time - duration
        : fixationStart // For fixations, use the reported start time

    // Validate that startTime is valid (not NaN and not Infinity)
    if (!isFinite(startTime)) return

    this.mCurrentFixation = {
      fixID,
      start: startTime,
      end: time,
      aoi,
      stimulus,
      category,
    }
  }

  /**
   * Flush the current fixation and return it as a serialized output
   */
  private flushCurrentFixation(): SingleDeserializerOutput | null {
    if (!this.mCurrentFixation) return null

    // Only return if we have valid timing data
    if (
      !isFinite(this.mCurrentFixation.start) ||
      !isFinite(this.mCurrentFixation.end)
    ) {
      this.mCurrentFixation = null
      return null
    }

    // Avoid zero-duration events
    if (this.mCurrentFixation.start === this.mCurrentFixation.end) {
      console.warn(
        'Zero duration event detected and skipped',
        this.mCurrentFixation.fixID,
        this.mCurrentFixation.stimulus,
        this.participant
      )
      this.mCurrentFixation = null
      return null
    }

    const result: SingleDeserializerOutput = {
      aoi:
        this.mCurrentFixation.aoi === null ? null : [this.mCurrentFixation.aoi],
      category: this.mCurrentFixation.category,
      end: String(this.mCurrentFixation.end),
      participant: this.participant,
      start: String(this.mCurrentFixation.start),
      stimulus: this.mCurrentFixation.stimulus,
    }

    this.mCurrentFixation = null
    return result
  }

  finalize(): SingleDeserializerOutput | null {
    // Flush any remaining fixation when we reach the end of the file
    return this.flushCurrentFixation()
  }
}

interface EyeTrackingParserGazePointReducerResult {
  aoi: string[] | null
  category: 'Fixation' | 'Blink'
  end: string
  participant: string
  start: string
  stimulus: string
}
