import { AbstractAdapter } from './AbstractAdapter'
import {
  bytesEqual,
  splitAoiColumn,
  encodeString,
} from '$lib/data/ingest/utils/byteUtils'

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
 * @extends AbstractAdapter
 *
 * @example
 * // CSV format:
 * // stimulus,participant,timestamp,duration,eyemovementtype,AOI
 * // SMI Base,Anna,226.2,72,1,
 * // SMI Base,Anna,298.2,120,0,Map
 */
export class CsvSegmentedDurationAdapter extends AbstractAdapter {
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

  /** Optional spatial X coordinate column index */
  cX: number

  /** Optional spatial Y coordinate column index */
  cY: number

  // Packed string columns
  private readonly pTimestamp = 0
  private readonly pDuration = 1
  private readonly pAoi = 2
  private readonly pParticipant = 3
  private readonly pStimulus = 4
  private readonly pEyeMovementType = 5
  private readonly pX = 6
  private readonly pY = 7

  /** Base time for the current participant/stimulus combination (used for time normalization) */
  mTimeBase: number | null = null

  /** Current participant being processed (used to detect when to reset base time) */
  mParticipantBytes: Uint8Array | null = null

  /** Current stimulus being processed (used to detect when to reset base time) */
  mStimulusBytes: Uint8Array | null = null

  protected readonly pipeDelimiterBytes: Uint8Array

  /**
   * Constructs a new CsvSegmentedDurationEyeDeserializer.
   *
   * Initializes column indices by searching for required fields in the header row.
   * Throws an error if any required field is missing from the header.
   *
   * @param {string[]} header - Array of column names from the CSV header row
   * @throws {Error} If any required column is not found in the header
   */
  constructor(
    header: string[],
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
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
    this.cX = this.findOptionalColumn(trimmedHeader, 'x')
    this.cY = this.findOptionalColumn(trimmedHeader, 'y')
    this.pipeDelimiterBytes = encodeString('|', encoding)

    this.setupColumns([
      this.cTimestamp,
      this.cDuration,
      this.cAoi,
      this.cParticipant,
      this.cStimulus,
      this.cEyeMovementType,
      this.cX,
      this.cY,
    ])
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
   * @returns {void}
   */
  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const timestampNum = this.getNumber(this.pTimestamp)
    const durationNum = this.getNumber(this.pDuration)
    const aoiBytes = this.getBytes(this.pAoi)
    const participantBytes = this.getBytes(this.pParticipant)
    const stimulusBytes = this.getBytes(this.pStimulus)
    const eyeMovementTypeBytes = this.getBytes(this.pEyeMovementType)

    if (
      !Number.isFinite(timestampNum) ||
      !Number.isFinite(durationNum) ||
      participantBytes.length === 0 ||
      stimulusBytes.length === 0
    )
      return

    const isNewTimebase =
      this.mTimeBase === null ||
      !bytesEqual(participantBytes, this.mParticipantBytes) ||
      !bytesEqual(stimulusBytes, this.mStimulusBytes)

    if (isNewTimebase) {
      this.mTimeBase = timestampNum
      this.mParticipantBytes = participantBytes
      this.mStimulusBytes = stimulusBytes
    }

    const baseTime = this.mTimeBase
    if (baseTime === null) return

    const normalizedStartTime = timestampNum - baseTime
    const normalizedEndTime = normalizedStartTime + durationNum

    const categoryId = this.isZero(eyeMovementTypeBytes) ? 0 : 1
    const aoi = splitAoiColumn(aoiBytes, this.pipeDelimiterBytes)
    const x = this.getNumber(this.pX)
    const y = this.getNumber(this.pY)
    const hasSpatialColumns = this.cX !== -1 && this.cY !== -1
    const spatial = hasSpatialColumns
      ? Number.isFinite(x) && Number.isFinite(y)
        ? { x, y }
        : null
      : undefined

    this.emitSegment(
      normalizedStartTime,
      normalizedEndTime,
      categoryId,
      stimulusBytes,
      participantBytes,
      aoi,
      spatial
    )
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
  finalize(): void {
    return
  }

  private isZero(bytes: Uint8Array): boolean {
    if (this.encoding === 'utf-16le') {
      return bytes.length === 2 && bytes[0] === 48 && bytes[1] === 0
    }
    if (this.encoding === 'utf-16be') {
      return bytes.length === 2 && bytes[0] === 0 && bytes[1] === 48
    }
    return bytes.length === 1 && bytes[0] === 48
  }

}
