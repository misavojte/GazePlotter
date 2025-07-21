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
  private readonly cAoiInfo: Array<{
    columnPosition: number
    aoiName: string
    stimulusName: string
  }>

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
  private readonly stimulusGetter: (row: string[]) => string | string[]
  private readonly stimuliBaseTimes: Map<string, string> = new Map()
  private readonly intervalStack: string[] = []

  static readonly TYPE = 'tobii'

  constructor(header: string[], userInput: string) {
    super()
    this.cRecordingTimestamp = header.indexOf('Recording timestamp')
    const altStim = header.indexOf('Presented Stimulus name')
    this.cStimulus =
      altStim === -1 ? header.indexOf('Recording media name') : altStim

    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    this.cCategory = header.indexOf('Eye movement type')
    this.cEvent = header.indexOf('Event')
    this.cEyeMovementTypeIndex = header.indexOf('Eye movement type index')
    this.cSensor = header.indexOf('Sensor')

    const stimuliDict = this.constructStimuliDictionary(header)
    this.cAoiInfo = this.constructAoiMapping(header, stimuliDict)

    this.stimulusGetter =
      userInput === EMPTY_STRING
        ? this.constructBaseStimulusGetter()
        : this.constructIntervalStimulusGetter(userInput)
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  deserialize = (row: string[]): DeserializerOutputType => {
    if (this.isEmptyRow(row)) {
      return null
    }

    // Always let the stimulusGetter update the interval stack from the Event column
    const stimulusResult = this.stimulusGetter(row)

    // Only process Eye Tracker rows for timing and AOI data
    if (!this.isEyeTrackerRow(row)) {
      return null
    }

    // learn sample interval for this participant+recording
    this.updateSampleInterval(row)

    if (this.isSameSegment(row, stimulusResult)) {
      this.mRecordingLast = row[this.cRecordingTimestamp]
      this.trackAoiHitsFromRow(row)
      this.mPrevEyeTrackerRow = row
      return null
    }

    const out = this.deserializeNewSegment(row, stimulusResult)
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

  /* ── Sensor filtering ───────────────────────────────────────────── */
  private isEyeTrackerRow(row: string[]): boolean {
    if (this.cSensor === -1) return true // No sensor column, use all rows
    return row[this.cSensor] === EYE_TRACKER_SENSOR
  }

  /* ── Segment boundaries ─────────────────────────────────────────── */
  private deserializeNewSegment(
    row: string[],
    stimulusResult: string | string[]
  ): DeserializerOutputType {
    const currentTs = row[this.cRecordingTimestamp]
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

    const previousSegment = this.getPreviousSegmentWithCorrectedEnd(midpoint)

    if (
      stimulusResult === EMPTY_STRING ||
      (Array.isArray(stimulusResult) && stimulusResult.length === 0)
    ) {
      this.mStimulus = EMPTY_STRING
      return previousSegment
    }

    // handle stimulus base‑time bookkeeping
    const activeStimuli = Array.isArray(stimulusResult)
      ? stimulusResult
      : [stimulusResult]

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
    for (const info of this.cAoiInfo)
      if (row[info.columnPosition] === '1')
        this.mAoiHitTracker.add(info.aoiName)
  }

  private isEmptyRow(row: string[]): boolean {
    return row[this.cCategory] === EMPTY_STRING
  }

  private isSameSegment(row: string[], stim: string | string[]): boolean {
    if (row[this.cEyeMovementTypeIndex] !== this.mEyeMovementTypeIndex)
      return false
    return Array.isArray(stim)
      ? stim.includes(this.mStimulus) &&
          stim[stim.length - 1] === this.mStimulus
      : stim === this.mStimulus
  }

  /* ── Segment creation helpers (unchanged) ───────────────────────── */
  private createSegmentsForIntervals(): DeserializerOutputType {
    return this.intervalStack.map(stimulus => {
      const key = stimulus + this.mParticipant
      const baseTime = this.stimuliBaseTimes.get(key) || this.mRecordingStart
      const start =
        (Number(this.mRecordingStart) - Number(baseTime)) * TIME_MODIFIER
      const end =
        (Number(this.mRecordingLast) - Number(baseTime)) * TIME_MODIFIER
      return {
        stimulus,
        participant: this.mParticipant,
        start: String(start),
        end: String(end),
        category: this.mCategory,
        aoi: this.mAoi,
      }
    })
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
  private constructStimuliDictionary(header: string[]): string[] {
    return [
      ...new Set(
        header
          .filter(c => c.startsWith(AOI_HIT_PREFIX))
          .map(c => c.replace(/AOI hit \[|\s-.*?]/g, ''))
      ),
    ].sort()
  }

  private constructAoiMapping(header: string[], dict: string[]) {
    const arr: Array<{
      columnPosition: number
      aoiName: string
      stimulusName: string
    }> = []
    for (const stim of dict) {
      const prefix = `${AOI_HIT_PREFIX}${stim}`
      header.forEach((h, i) => {
        if (h.startsWith(prefix))
          arr.push({
            columnPosition: i,
            aoiName: h.replace(/A.*?- |]/g, ''),
            stimulusName: stim,
          })
      })
    }
    return arr
  }

  private constructBaseStimulusGetter() {
    return (row: string[]) => row[this.cStimulus]
  }

  private constructIntervalStimulusGetter(userInput: string) {
    const [startMarker, endMarker] = userInput.split(';')
    return (row: string[]): string | string[] => {
      const evt = row[this.cEvent]
      if (!evt)
        return this.intervalStack.length ? this.intervalStack : EMPTY_STRING
      if (evt.includes(startMarker)) {
        const s = evt.replace(startMarker, '').trim()
        if (!this.intervalStack.includes(s)) this.intervalStack.push(s)
        return this.intervalStack
      }
      if (evt.includes(endMarker)) {
        const s = evt.replace(endMarker, '').trim()
        const i = this.intervalStack.indexOf(s)
        if (i !== -1) this.intervalStack.splice(i, 1)
        return this.intervalStack.length ? this.intervalStack : EMPTY_STRING
      }
      return this.intervalStack.length ? this.intervalStack : EMPTY_STRING
    }
  }
}
