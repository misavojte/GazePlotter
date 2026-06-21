import { RowParser } from './RowParser'
import {
  bytesEqual,
  splitAoiColumn,
  encodeString,
} from '$lib/data/ingest/utils/byteUtils'

/**
 * Row parser for CSV files containing segmented eye-tracking data with duration-based timing.
 *
 * It handles CSV files where each row represents a complete eye movement segment
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
 * @extends RowParser
 *
 * @example
 * // CSV format:
 * // stimulus,participant,timestamp,duration,eyemovementtype,AOI
 * // SMI Base,Anna,226.2,72,1,
 * // SMI Base,Anna,298.2,120,0,Map
 */
export class CsvSegmentedDurationRowParser extends RowParser {
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

  /** Decoder + byte length used to recognise the fixation category by name. */
  private readonly fixationDecoder: TextDecoder
  private readonly fixationByteLength: number

  /** Canonical category-name bytes for the two non-named codes (0, non-zero). */
  private readonly fixationNameBytes: Uint8Array
  private readonly saccadeNameBytes: Uint8Array

  /**
   * Constructs a new CsvSegmentedDurationRowParser.
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
    this.fixationDecoder = new TextDecoder(encoding)
    this.fixationByteLength = encodeString('fixation', encoding).length
    this.fixationNameBytes = encodeString('Fixation', encoding)
    this.saccadeNameBytes = encodeString('Saccade', encoding)

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
   * Parses a single row from a CSV file into a SegmentRow object.
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
   * - Eye movement types: "0" or "fixation" (case-insensitive) = Fixation,
   *   all other values = Saccade
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

    // Resolve the eye-movement type to a category. "0"/"fixation" canonicalise
    // to Fixation (id 0). A non-negative integer code (or an empty cell) has no
    // name, so it keeps the legacy single "Saccade" category. Any other token
    // (e.g. "Saccade", "Unclassified", or an unusual code like "-1") is
    // preserved verbatim as its own category — this is what lets a GazePlotter
    // named export round-trip with distinct types.
    const categoryName =
      this.isFixation(eyeMovementTypeBytes)
        ? this.fixationNameBytes
        : this.isAllDigits(eyeMovementTypeBytes) ||
            eyeMovementTypeBytes.length === 0
          ? this.saccadeNameBytes
          : eyeMovementTypeBytes
    const categoryId = this.resolveCategoryId(categoryName)
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
   * Finalizes parsing.
   *
   * Since this parser processes each row as a complete segment without maintaining
   * state across rows, there is nothing to finalize. This method exists to satisfy the
   * RowParser interface contract.
   *
   * @returns {null} Always returns null as no finalization is needed
   */
  finalize(): void {
    return
  }

  /**
   * Whether the eye-movement-type token denotes a fixation. Accepts the numeric
   * code "0" as well as the category name "fixation" (case-insensitive), so a
   * GazePlotter segmented CSV exported with named movement types re-imports with
   * the fixation class intact. The length guard keeps the common numeric path
   * (e.g. "1") free of any per-row string decode.
   */
  private isFixation(bytes: Uint8Array): boolean {
    if (this.isZero(bytes)) return true
    if (bytes.length !== this.fixationByteLength) return false
    return this.fixationDecoder.decode(bytes).toLowerCase() === 'fixation'
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

  /**
   * Whether the token is a non-empty run of ASCII digits (a numeric code with
   * no associated name, e.g. "1", "2"). Such codes collapse to the single
   * "Saccade" category since no source name is available.
   */
  private isAllDigits(bytes: Uint8Array): boolean {
    if (bytes.length === 0) return false
    if (this.encoding === 'utf-16le') {
      if (bytes.length % 2 !== 0) return false
      for (let i = 0; i < bytes.length; i += 2) {
        if (bytes[i + 1] !== 0 || bytes[i] < 48 || bytes[i] > 57) return false
      }
      return true
    }
    if (this.encoding === 'utf-16be') {
      if (bytes.length % 2 !== 0) return false
      for (let i = 0; i < bytes.length; i += 2) {
        if (bytes[i] !== 0 || bytes[i + 1] < 48 || bytes[i + 1] > 57) return false
      }
      return true
    }
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] < 48 || bytes[i] > 57) return false
    }
    return true
  }
}
