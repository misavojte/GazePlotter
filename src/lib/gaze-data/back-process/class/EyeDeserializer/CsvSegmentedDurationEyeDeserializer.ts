import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

/**
 * Deserializer for CSV files containing segmented eye-tracking data with duration-based timing.
 * 
 * This deserializer handles CSV files where each row represents a complete eye movement segment
 * with the following characteristics:
 * - `timestamp`: Start time of the segment in milliseconds
 * - `duration`: Duration of the segment in milliseconds
 * - `eyemovementtype`: Type of eye movement (0 = Fixation, 1 = Saccade, etc.)
 * - `AOI`: Area of Interest (can be empty)
 * - `participant`: Participant identifier
 * - `stimulus`: Stimulus identifier
 * 
 * The end time is calculated as: `timestamp + duration`
 * 
 * Time normalization:
 * - For each participant/stimulus combination, the first timestamp is used as a base time
 * - All timestamps are normalized relative to this base time (timestamp - baseTime)
 * - This ensures all segments start from 0 for each stimulus
 * 
 * @extends AbstractEyeDeserializer
 * 
 * @example
 * // CSV format:
 * // stimulus,participant,timestamp,duration,eyemovementtype,AOI
 * // SMI Base,Anna,226.2,72,1,
 * // SMI Base,Anna,298.2,120,0,Map
 */
export class CsvSegmentedDurationEyeDeserializer extends AbstractEyeDeserializer {
  /** Column index for timestamp field */
  cTimestamp: number
  
  /** Column index for duration field */
  cDuration: number
  
  /** Column index for participant field */
  cParticipant: number
  
  /** Column index for stimulus field */
  cStimulus: number
  
  /** Column index for AOI (Area of Interest) field */
  cAoi: number
  
  /** Column index for eye movement type field */
  cEyeMovementType: number

  /** Base time for the current participant/stimulus combination (used for time normalization) */
  mTimeBase: number | null = null
  
  /** Current participant being processed (used to detect when to reset base time) */
  mParticipant = ''
  
  /** Current stimulus being processed (used to detect when to reset base time) */
  mStimulus = ''

  /**
   * Constructs a new CsvSegmentedDurationEyeDeserializer.
   * 
   * Initializes column indices by searching for required fields in the header row.
   * Throws an error if any required field is missing from the header.
   * 
   * @param {string[]} header - Array of column names from the CSV header row
   * @throws {Error} If any required column is not found in the header
   */
  constructor(header: string[]) {
    super()
    // Trim whitespace from header values to handle potential BOM or whitespace issues
    const trimmedHeader = header.map(h => h.trim())
    
    // Extract column indices from the header row using the inherited getIndex method
    // getIndex will throw an error if any required column is missing
    this.cTimestamp = this.getIndex(trimmedHeader, 'timestamp')
    this.cDuration = this.getIndex(trimmedHeader, 'duration')
    this.cAoi = this.getIndex(trimmedHeader, 'AOI')
    this.cParticipant = this.getIndex(trimmedHeader, 'participant')
    this.cStimulus = this.getIndex(trimmedHeader, 'stimulus')
    this.cEyeMovementType = this.getIndex(trimmedHeader, 'eyemovementtype')
  }

  /**
   * Deserializes a single row from a CSV file into a DeserializerOutputType object.
   * 
   * This function extracts values from the row, validates required fields, calculates
   * the end time from timestamp and duration, and maps the eye movement type to a category.
   * 
   * Time normalization is applied per participant/stimulus combination:
   * - The first timestamp for each combination becomes the base time
   * - All subsequent timestamps are normalized relative to this base (timestamp - baseTime)
   * - When switching to a new participant/stimulus, the base time is reset
   * 
   * Validation rules:
   * - Returns null if any required field (timestamp, duration, participant, stimulus) is empty
   * - Empty AOI values are converted to null
   * - Eye movement types: 0 = Fixation, all other values = Saccade
   * 
   * Time calculation:
   * - Normalized start time = timestamp - baseTime
   * - Normalized end time = (timestamp + duration) - baseTime
   * 
   * @param {string[]} row - An array representing a single row from the CSV file
   * @returns {DeserializerOutputType | null} Deserialized segment data, or null if validation fails
   */
  deserialize(row: string[]): DeserializerOutputType {
    // Extract raw values from the row using the column indices
    const timestamp = row[this.cTimestamp]
    const duration = row[this.cDuration]
    const aoi = row[this.cAoi]
    const participant = row[this.cParticipant]
    const stimulus = row[this.cStimulus]
    const eyeMovementType = row[this.cEyeMovementType]

    // Validate that all required fields contain data
    // Return null for invalid rows - they will be filtered out in the pipeline
    if (
      timestamp === '' ||
      duration === '' ||
      participant === '' ||
      stimulus === ''
    ) {
      return null
    }

    // Parse numeric values for time calculations
    const timestampNum = Number(timestamp)
    const durationTime = Number(duration)

    // Check if this is a new participant/stimulus combination
    // If so, reset the base time to the current timestamp
    const isNewTimebase =
      this.mTimeBase === null ||
      participant !== this.mParticipant ||
      stimulus !== this.mStimulus

    if (isNewTimebase) {
      // Set base time to the first timestamp of this participant/stimulus combination
      this.mTimeBase = timestampNum
      // Update the tracked participant and stimulus
      this.mParticipant = participant
      this.mStimulus = stimulus
    }

    // Get the base time for normalization (should never be null at this point)
    const baseTime = this.mTimeBase
    if (baseTime === null) {
      throw new Error('Base time is null after initialization')
    }

    // Normalize timestamps relative to the base time
    // This ensures all segments start from 0 for each participant/stimulus combination
    const normalizedStartTime = timestampNum - baseTime
    const normalizedEndTime = normalizedStartTime + durationTime

    // Map eye movement type to category
    // Convention: 0 = Fixation, all other values (typically 1) = Saccade
    const category = eyeMovementType === '0' ? 'Fixation' : 'Saccade'

    // Return the deserialized segment following the SingleDeserializerOutput interface
    return {
      // Convert AOI: empty string becomes null, otherwise wrap in array for consistency
      aoi: aoi === '' ? null : [aoi],
      category: category,
      // Convert normalized numeric times back to strings for consistency with other deserializers
      start: String(normalizedStartTime),
      end: String(normalizedEndTime),
      participant: participant,
      stimulus: stimulus,
    }
  }

  /**
   * Finalizes the deserialization process.
   * 
   * Since this deserializer processes each row as a complete segment without maintaining
   * state across rows, there is nothing to finalize. This method exists to satisfy the
   * AbstractEyeDeserializer interface contract.
   * 
   * @returns {null} Always returns null as no finalization is needed
   */
  finalize(): DeserializerOutputType {
    return null
  }
}

