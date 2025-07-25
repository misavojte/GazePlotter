import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

const TIME_MODIFIER = 0.001 // µs → ms
const EMPTY_STRING = ''
const AOI_HIT_PREFIX = 'AOI hit ['

/**
 * The expected value in the Sensor column for eye tracking data rows.
 * Only rows with this sensor value will be used for timing and AOI calculations.
 */
const EYE_TRACKER_SENSOR = 'Eye Tracker'

/**
 * Minimum plausible sample interval in microseconds (e.g., 900µs for a ~1111Hz tracker).
 * Used for learning the sample rate from the data.
 */
const MIN_SAMPLE_INTERVAL_US = 900

/**
 * Maximum plausible sample interval in microseconds (e.g., 50ms for a 20Hz tracker).
 * Used for learning the sample rate from the data.
 */
const MAX_SAMPLE_INTERVAL_US = 50000

/**
 * A tolerance factor to account for jitter in sample timestamps. A segment start
 * is corrected if the gap to the previous sample is no more than the nominal
 * sample interval multiplied by this factor.
 */
const SAMPLE_INTERVAL_TOLERANCE_FACTOR = 1.5

/**
 * Deserializer for Tobii Pro Lab TSV exports.
 *
 * ### Tobii quirks handled
 * 1. **Interval‑based stimuli** – `%STIMULUS% IntervalStart` / `IntervalEnd` rows may appear in the
 *    middle of an eye‑movement segment; we maintain a stack so multiple stimuli can overlap.
 * 2. **AOI‑hit variability inside one segment** – Tobii may flag `AOI hit` columns inconsistently
 *    across rows that share the same `Eye movement type index`.  We aggregate all hits across the
 *    segment via a `Set`.
 * 3. **Fixation‑onset timestamp (half‑sample correction)** – Pro Lab defines the start of a fixation
 *    half a frame before the first fixation‑labelled row.  We learn the nominal sample interval per
 *    *participant + recording* and, provided the gap is ≤ 1.5 × that interval, back‑shift the
 *    segment start by exactly half an interval.  When a larger gap is detected (data drop‑out) we
 *    fall back to using the raw timestamp to avoid absurd durations.
 * 4. **Sensor column filtering** – If a Sensor column is present, only rows with "Eye Tracker"
 *    sensor value are used for timing and AOI data. IntervalStart/IntervalEnd events may have
 *    empty sensor values but timing is handled via edging principle.
 * 5. **Segment end correction** – Similar to start correction, segment ends are adjusted to
 *    eliminate gaps between consecutive segments.
 * 6. **Robust AOI Aggregation** - All `AOI hit [...]` columns are scanned on every eye-tracker
 *    row, regardless of the active stimulus. This is more robust than stimulus-specific
 *    AOI parsing, which can fail if stimulus and AOI names don't align perfectly.
 * 7. **Mapped Column Priority** – The deserializer prioritizes "Mapped eye movement type" and
 *    "Mapped eye movement type index" columns over their regular counterparts when available.
 *    These mapped columns may have dynamic suffixes (e.g., "[participant_id]"). Segment
 *    boundaries are determined by the combination of BOTH eye movement type AND type index.
 * 8. **IntervalStart Timestamp Priority** – When available, IntervalStart event timestamps are
 *    used as segment start times instead of the first Eye Tracker row timestamp. This addresses
 *    Tobii's quirk where the true event start (IntervalStart) occurs before the first eye
 *    tracking data, providing more accurate timing alignment with Tobii Pro Lab's expectations.
 *
 * @extends AbstractEyeDeserializer
 * @category Eye
 * @subcategory Deserializer
 */
export class TobiiEyeDeserializer extends AbstractEyeDeserializer {
  /* ── Column indices ─────────────────────────────────────────────── */
  private readonly cRecordingTimestamp: number
  private readonly cStimulus: number
  private readonly cParticipant: number
  private readonly cRecording: number
  private readonly cCategory: number
  private readonly cEvent: number
  private readonly cEyeMovementTypeIndex: number
  private readonly cSensor: number // -1 if not present

  /**
   * @private
   * Stores pre-computed column information for all AOIs.
   *
   * This optimization assumes that all "AOI hit" columns in the Tobii export
   * are contiguous. We find the start and end column index of this block once.
   * This allows `trackAoiHitsFromRow` to use a fast numeric `for` loop over a
   * relevant slice of the data row.
   *
   * Previously, this was a Map keyed by stimulus name. This was removed because
   * the active stimulus might not always correctly correspond to the AOI columns,
   * leading to missed hits. This simpler approach is more robust.
   */
  private readonly _mAoiColumnInfo: {
    start: number
    end: number
    names: string[]
  } | null

  /* ── Mutable segment state ──────────────────────────────────────── */
  private mStimulus = EMPTY_STRING
  private mParticipant = EMPTY_STRING
  private mRecordingStart = EMPTY_STRING
  private mEyeMovementTypeIndex = EMPTY_STRING
  private mRecordingLast = EMPTY_STRING
  private mCategory = EMPTY_STRING
  private mAoi: string[] | null = null
  private mAoiHitTracker: Set<string> = new Set()
  private mPrevEyeTrackerRow: string[] | null = null

  /* ── Sampling interval learning ─────────────────────────────────── */
  /** Sample interval cache (micro‑seconds) keyed by `recording|participant`. */
  private readonly sampleIntervals: Map<string, number> = new Map()

  /* ── Stimulus helpers ───────────────────────────────────────────── */
  private readonly stimulusGetter: (row: string[]) => string[]
  private readonly stimuliBaseTimes: Map<string, string> = new Map()
  private readonly intervalStack: string[] = []

  /**
   * Tracks IntervalStart timestamps for each stimulus+participant combination.
   * Key format: `stimulusName|recording|participant`
   * Value: timestamp from the IntervalStart event
   */
  private readonly intervalStartTimes: Map<string, string> = new Map()

  static readonly TYPE = 'tobii'

  constructor(header: string[], userInput: string) {
    super()
    this.cRecordingTimestamp = header.indexOf('Recording timestamp')
    const altStim = header.indexOf('Presented Stimulus name')
    this.cStimulus =
      altStim === -1 ? header.indexOf('Recording media name') : altStim

    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')

    // Prioritize "Mapped eye movement type" columns over regular ones
    this.cCategory =
      this.findColumnByPrefix(header, 'Mapped eye movement type') ??
      header.indexOf('Eye movement type')

    this.cEvent = header.indexOf('Event')

    // Prioritize "Mapped eye movement type index" columns over regular ones
    this.cEyeMovementTypeIndex =
      this.findColumnByPrefix(header, 'Mapped eye movement type index') ??
      header.indexOf('Eye movement type index')

    this.cSensor = header.indexOf('Sensor')

    this._mAoiColumnInfo = this.constructAoiInfo(header)

    this.stimulusGetter =
      userInput === EMPTY_STRING
        ? this.constructBaseStimulusGetter()
        : this.constructIntervalStimulusGetter(userInput)
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  deserialize = (row: string[]): DeserializerOutputType => {
    // The stimulusGetter must always run first, as non-eye-tracker rows can
    // contain critical IntervalStart/IntervalEnd events that update the stack.
    const stimulusResult = this.stimulusGetter(row)

    // --- Guard Clause for the Hot Path ---
    // We only proceed to the expensive segment-processing logic if the row
    // contains actual eye tracking data.
    if (
      row[this.cCategory] === EMPTY_STRING ||
      (this.cSensor !== -1 && row[this.cSensor] !== EYE_TRACKER_SENSOR)
    ) {
      return null
    }

    // --- Hot Path: We know this is a valid Eye Tracker row. ---

    // Optimization: Look up timestamp once, as it's used in multiple places.
    const currentTimestamp = row[this.cRecordingTimestamp]

    // learn sample interval for this participant+recording
    this.updateSampleInterval(row)

    // --- Inlined isSameSegment() for Maximum Performance ---
    // The logic from the
    // isSameSegment method has been manually inlined here to eliminate all
    // function call overhead for the most common case: processing rows that
    // are part of the same, continuous eye-movement segment.

    // First, a fast check on both the movement type index and type.
    if (
      row[this.cEyeMovementTypeIndex] === this.mEyeMovementTypeIndex &&
      row[this.cCategory] === this.mCategory
    ) {
      // The segment type is the same. Now, we perform the full check for stimulus
      // continuity. For both base and interval-based parsing, continuity is
      // determined by checking if the active stimulus has changed from the previous row.
      const lastStimulus =
        stimulusResult.length > 0
          ? stimulusResult[stimulusResult.length - 1]
          : undefined
      if (lastStimulus === this.mStimulus) {
        // The segment continues. Update the end time and track AOIs.
        this.mRecordingLast = currentTimestamp
        this.trackAoiHitsFromRow(row)
        this.mPrevEyeTrackerRow = row
        return null
      }
    }

    const out = this.deserializeNewSegment(
      row,
      stimulusResult,
      currentTimestamp
    )
    this.mPrevEyeTrackerRow = row
    return out
  }

  finalize(): DeserializerOutputType {
    if (
      !this.mParticipant ||
      !this.mStimulus ||
      !this.mRecordingStart ||
      !this.mPrevEyeTrackerRow
    ) {
      return null
    }

    const lastTimestamp = Number(
      this.mPrevEyeTrackerRow[this.cRecordingTimestamp]
    )
    const sampleKey = `${this.mPrevEyeTrackerRow[this.cRecording]}|${
      this.mPrevEyeTrackerRow[this.cParticipant]
    }`
    const sampInt = this.sampleIntervals.get(sampleKey)

    let correctedEnd = String(lastTimestamp)
    if (sampInt) {
      correctedEnd = String(lastTimestamp + sampInt / 2)
    }

    this.mRecordingLast = correctedEnd
    this.mAoi = Array.from(this.mAoiHitTracker)

    const result = this.intervalStack.length
      ? this.createSegmentsForIntervals()
      : this.createSegmentForSingleStimulus()

    return result
  }

  /* ── Segment boundaries ─────────────────────────────────────────── */
  private deserializeNewSegment(
    row: string[],
    stimulusResult: string[],
    currentTs: string
  ): DeserializerOutputType {
    const currTsNum = Number(currentTs)

    const participant = `${row[this.cRecording]} ${row[this.cParticipant]}`
    const sampleKey = `${row[this.cRecording]}|${row[this.cParticipant]}`
    const sampInt = this.sampleIntervals.get(sampleKey) ?? null

    /* Double edge approach: calculate midpoint to eliminate gaps */
    let correctedStart = currentTs
    let midpoint: string | null = null

    if (sampInt && this.mPrevEyeTrackerRow) {
      const prevEyeTrackerTs = Number(
        this.mPrevEyeTrackerRow[this.cRecordingTimestamp]
      )
      const delta = currTsNum - prevEyeTrackerTs
      if (delta <= sampInt * SAMPLE_INTERVAL_TOLERANCE_FACTOR) {
        // Calculate midpoint between previous Eye Tracker sample and current Eye Tracker sample
        midpoint = String(prevEyeTrackerTs + delta / 2)
        correctedStart = midpoint
      }
    }

    /* Check for IntervalStart timestamp - prioritize it for true event start timing */
    if (stimulusResult.length > 0) {
      const activeStimulus = stimulusResult[stimulusResult.length - 1]
      const intervalStartKey = `${activeStimulus}|${row[this.cRecording]}|${row[this.cParticipant]}`
      const intervalStartTs = this.intervalStartTimes.get(intervalStartKey)

      if (intervalStartTs) {
        const intervalStartNum = Number(intervalStartTs)
        const timeDelta = currTsNum - intervalStartNum

        // If IntervalStart is reasonably close and earlier than current timestamp, use it
        // Allow up to 50ms gap (typical for Tobii data structure quirks)
        if (timeDelta > 0 && timeDelta <= 50000) {
          // 50ms in microseconds
          correctedStart = intervalStartTs
          midpoint = null // Clear midpoint since we're using IntervalStart

          // Clean up: remove the IntervalStart timestamp since it's only needed once
          this.intervalStartTimes.delete(intervalStartKey)
        }
      }
    }

    const previousSegment = this.getPreviousSegmentWithCorrectedEnd(midpoint)

    if (stimulusResult.length === 0) {
      this.mStimulus = EMPTY_STRING
      return previousSegment
    }

    // handle stimulus base‑time bookkeeping
    const activeStimuli = stimulusResult

    if (activeStimuli.length > 0) {
      this.mStimulus = activeStimuli[activeStimuli.length - 1]
      for (const stim of activeStimuli) {
        const key = stim + participant
        if (!this.stimuliBaseTimes.has(key)) {
          // This is the first segment for this stimulus.
          // Its base time is the start time of this segment.
          this.stimuliBaseTimes.set(key, correctedStart)
        }
      }
    }

    /* mutate state for new segment */
    this.mParticipant = participant
    this.mRecordingStart = correctedStart
    this.mCategory = row[this.cCategory]
    this.mAoiHitTracker.clear()
    this.trackAoiHitsFromRow(row)

    this.mEyeMovementTypeIndex = row[this.cEyeMovementTypeIndex]
    this.mRecordingLast = currentTs

    return previousSegment
  }

  private getPreviousSegmentWithCorrectedEnd(
    midpoint: string | null
  ): DeserializerOutputType {
    if (
      !this.mParticipant ||
      !this.mStimulus ||
      !this.mRecordingStart ||
      this.mRecordingLast === this.mRecordingStart
    )
      return null

    this.mAoi = Array.from(this.mAoiHitTracker)

    // Use the calculated midpoint as the corrected end if available
    const correctedEnd = midpoint || this.mRecordingLast

    // Temporarily store the corrected end
    const originalEnd = this.mRecordingLast
    this.mRecordingLast = correctedEnd

    const result = this.intervalStack.length
      ? this.createSegmentsForIntervals()
      : this.createSegmentForSingleStimulus()

    // Restore original end for state consistency
    this.mRecordingLast = originalEnd

    return result
  }

  /* ── Sample interval learning ───────────────────────────────────── */
  private updateSampleInterval(row: string[]): void {
    if (!this.mPrevEyeTrackerRow) return
    const key = `${row[this.cRecording]}|${row[this.cParticipant]}`
    if (this.sampleIntervals.has(key)) return
    const prevTs = Number(this.mPrevEyeTrackerRow[this.cRecordingTimestamp])
    const currTs = Number(row[this.cRecordingTimestamp])
    const delta = currTs - prevTs
    if (delta >= MIN_SAMPLE_INTERVAL_US && delta <= MAX_SAMPLE_INTERVAL_US) {
      // accept ~20-1111 Hz as plausible raw frame interval (mobile eye trackers can be slower)
      this.sampleIntervals.set(key, delta)
    }
  }

  /* ── AOI aggregation & helpers (unchanged logic) ────────────────── */
  private trackAoiHitsFromRow(row: string[]): void {
    if (!this._mAoiColumnInfo) {
      return
    }

    const { start, end, names } = this._mAoiColumnInfo
    for (let i = start; i <= end; i++) {
      if (row[i] === '1') {
        // The index into the names array is the current column index
        // offset by the start of the AOI block for this stimulus.
        const aoiName = names[i - start]
        if (aoiName) {
          this.mAoiHitTracker.add(aoiName)
        }
      }
    }
  }

  /* ── Segment creation helpers ───────────────────────── */
  private createSegmentsForIntervals(): DeserializerOutputType {
    const segments: DeserializerOutputType = []
    for (const stimulus of this.intervalStack) {
      const key = stimulus + this.mParticipant
      const baseTime = this.stimuliBaseTimes.get(key) || this.mRecordingStart
      const start =
        (Number(this.mRecordingStart) - Number(baseTime)) * TIME_MODIFIER
      const end =
        (Number(this.mRecordingLast) - Number(baseTime)) * TIME_MODIFIER
      segments.push({
        stimulus,
        participant: this.mParticipant,
        start: String(start),
        end: String(end),
        category: this.mCategory,
        aoi: this.mAoi,
      })
    }
    return segments
  }

  private createSegmentForSingleStimulus(): DeserializerOutputType {
    const key = this.mStimulus + this.mParticipant
    const baseTime = this.stimuliBaseTimes.get(key) || this.mRecordingStart
    const start =
      (Number(this.mRecordingStart) - Number(baseTime)) * TIME_MODIFIER
    const end = (Number(this.mRecordingLast) - Number(baseTime)) * TIME_MODIFIER

    return {
      stimulus: this.mStimulus,
      participant: this.mParticipant,
      start: String(start),
      end: String(end),
      category: this.mCategory,
      aoi: this.mAoi,
    }
  }

  /* ── Utility: stimuli & AOI mapping (unchanged) ─────────────────── */
  private constructAoiInfo(
    header: string[]
  ): { start: number; end: number; names: string[] } | null {
    let startIndex = -1
    let endIndex = -1

    // First, find the global start and end index of all AOI columns.
    for (let i = 0; i < header.length; i++) {
      if (header[i].startsWith(AOI_HIT_PREFIX)) {
        if (startIndex === -1) {
          startIndex = i
        }
        endIndex = i
      }
    }

    // If no AOI columns were found, return null.
    if (startIndex === -1) {
      return null
    }

    // Now, create the names array for the entire contiguous block.
    // This assumes all columns between startIndex and endIndex are AOI hits.
    // If there is a non-AOI column in the mix (unexpected), its name will be
    // an empty string, and it will be ignored during hit tracking.
    const aoiNames: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      const h = header[i]
      if (h.startsWith(AOI_HIT_PREFIX)) {
        // From "AOI hit [Stim - Name]" to "Name" by splitting at the last " - "
        const fullName = h.substring(AOI_HIT_PREFIX.length, h.length - 1)
        aoiNames.push(fullName.substring(fullName.lastIndexOf(' - ') + 3))
      } else {
        aoiNames.push(EMPTY_STRING) // Placeholder for non-AOI columns
      }
    }

    return { start: startIndex, end: endIndex, names: aoiNames }
  }

  private constructBaseStimulusGetter() {
    return (row: string[]): string[] => {
      const stim = row[this.cStimulus]
      return stim ? [stim] : []
    }
  }

  private constructIntervalStimulusGetter(userInput: string) {
    const parts = userInput.split(';')

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      // This is a developer-facing error for a misconfiguration.
      // Throwing an error is appropriate to prevent silent failure and
      // difficult-to-debug behavior downstream.
      throw new Error(
        `Invalid Tobii interval marker format. Expected "start;end", but received "${userInput}". Both markers must be non-empty.`
      )
    }
    const [startMarker, endMarker] = parts

    return (row: string[]): string[] => {
      const evt = row[this.cEvent]
      if (!evt) return this.intervalStack

      // This logic is optimized for performance. The user is expected to provide
      // the full suffix, including any delimiter (e.g., " IntervalStart" or "_start").
      // The parser then uses a fast .endsWith() check and slices the exact
      // length of the marker, avoiding slower, generic .replace() calls.

      if (evt.endsWith(startMarker)) {
        const stimulusName = evt.substring(0, evt.length - startMarker.length)
        if (!this.intervalStack.includes(stimulusName)) {
          this.intervalStack.push(stimulusName)

          // Capture IntervalStart timestamp for this stimulus+participant combination
          const key = `${stimulusName}|${row[this.cRecording]}|${row[this.cParticipant]}`
          this.intervalStartTimes.set(key, row[this.cRecordingTimestamp])
        }
        return this.intervalStack
      }

      if (evt.endsWith(endMarker)) {
        const stimulusName = evt.substring(0, evt.length - endMarker.length)
        const i = this.intervalStack.indexOf(stimulusName)
        if (i !== -1) this.intervalStack.splice(i, 1)
        return this.intervalStack
      }

      return this.intervalStack
    }
  }

  /* ── Private helper methods ─────────────────────────────────────── */

  /**
   * Finds a column index by matching the beginning of the column name.
   * This handles dynamic column names like "Mapped eye movement type [geostul]".
   *
   * @param header - Array of column header names
   * @param prefix - The prefix to search for (e.g., "Mapped eye movement type")
   * @returns The index of the first matching column, or null if not found
   */
  private findColumnByPrefix(header: string[], prefix: string): number | null {
    for (let i = 0; i < header.length; i++) {
      if (header[i].startsWith(prefix)) {
        return i
      }
    }
    return null
  }
}
