import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

const TIME_MODIFIER = 0.001 // µs → ms
const EMPTY_STRING = ''
const AOI_HIT_PREFIX = 'AOI hit ['
const EYE_TRACKER_SENSOR = 'Eye Tracker'
const MIN_SAMPLE_INTERVAL_US = 900
const MAX_SAMPLE_INTERVAL_US = 50000
const SAMPLE_INTERVAL_TOLERANCE_FACTOR = 1.5
const WEB_STIMULUS_TRIGGER = 'WebStimulus'

export class TobiiEyeDeserializer extends AbstractEyeDeserializer {
  /* ── Column indices ─────────────────────────────────────────────── */
  private readonly cRecordingTimestamp: number
  private readonly cStimulus: number
  private readonly cParticipant: number
  private readonly cRecording: number
  private readonly cCategory: number
  private readonly cEvent: number
  private readonly cEventValue: number
  private readonly cEyeMovementTypeIndex: number
  private readonly cSensor: number

  private readonly pRecordingTimestamp = 0
  private readonly pStimulus = 1
  private readonly pParticipant = 2
  private readonly pRecording = 3
  private readonly pCategory = 4
  private readonly pEvent = 5
  private readonly pEventValue = 6
  private readonly pEyeMovementTypeIndex = 7
  private readonly pSensor = 8

  /* ── Optimized AOI Info ─────────────────────────────────────────── */
  private readonly aoiNames: string[] = []
  private readonly hasSensorColumn: boolean

  /* ── Mutable segment state ──────────────────────────────────────── */
  private mStimulus = EMPTY_STRING
  private mParticipant = EMPTY_STRING
  private mRecordingStart: number | null = null
  private mEyeMovementTypeIndex = EMPTY_STRING
  private mRecordingLast: number | null = null
  private mCategory = EMPTY_STRING
  private mAoi: string[] | null = null
  private mAoiHitTracker: Set<string> = new Set()

  // Last processed Eye Tracker row (not necessarily the previous input row).
  // Tobii exports can interleave IntervalStart/IntervalEnd events between samples.
  private lastEyeTrackerTimestamp: number | null = null
  private lastEyeTrackerSampleKey: string | null = null

  /* ── Sampling interval learning ─────────────────────────────────── */
  private readonly sampleIntervals: Map<string, number> = new Map()

  /* ── Stimulus helpers ───────────────────────────────────────────── */
  private readonly stimulusUpdater: () => void
  private cachedStimulusStack: string[] = []

  private readonly stimuliBaseTimes: Map<string, number> = new Map()
  private readonly intervalStack: Set<string> = new Set()
  private readonly intervalStartTimes: Map<string, number> = new Map()

  /* ── Optimization Caches ────────────────────────────────────────── */
  private cachedParticipantKey: string = ''
  private lastParticipantRaw: string = ''
  private lastRecordingRaw: string = ''

  static readonly TYPE = 'tobii'

  constructor(header: string[], userInput: string, columnDelimiter: string) {
    super(columnDelimiter)
    this.cRecordingTimestamp = header.indexOf('Recording timestamp')
    const altStim = header.indexOf('Presented Stimulus name')
    this.cStimulus =
      altStim === -1 ? header.indexOf('Recording media name') : altStim
    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    this.cCategory =
      this.findColumnByPrefix(header, 'Mapped eye movement type') ??
      header.indexOf('Eye movement type')
    this.cEvent = header.indexOf('Event')
    this.cEventValue = header.indexOf('Event value')
    this.cEyeMovementTypeIndex =
      this.findColumnByPrefix(header, 'Mapped eye movement type index') ??
      header.indexOf('Eye movement type index')
    this.cSensor = header.indexOf('Sensor')

    this.hasSensorColumn = this.cSensor !== -1

    this.setupColumns([
      this.cRecordingTimestamp,
      this.cStimulus,
      this.cParticipant,
      this.cRecording,
      this.cCategory,
      this.cEvent,
      this.cEventValue,
      this.cEyeMovementTypeIndex,
      this.cSensor,
    ])

    const aoiInfo = this.constructAoiInfo(header)
    if (aoiInfo) {
      this.aoiNames.push(...aoiInfo.names)
      this.setupAoiColumns(aoiInfo.start, aoiInfo.names.length)
    }

    if (userInput === WEB_STIMULUS_TRIGGER) {
      this.stimulusUpdater = this.constructWebStimulusUpdater()
    } else {
      this.stimulusUpdater =
        userInput === EMPTY_STRING
          ? this.constructBaseStimulusUpdater()
          : this.constructIntervalStimulusUpdater(userInput)
    }
  }

  /* ── Helpers ────────────────────────────────────────────────────── */

  private updateCachedStimulusStack(): void {
    this.cachedStimulusStack = this.intervalStack.size
      ? Array.from(this.intervalStack)
      : []
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  deserialize(_rawRowRef: string): DeserializerOutputType {
    // 1) Update Stimulus State (based on current packed row)
    this.stimulusUpdater()

    const category = this.getCurr(this.pCategory) || EMPTY_STRING

    if (this.hasSensorColumn) {
      if (this.getCurr(this.pSensor) !== EYE_TRACKER_SENSOR) return null
    }

    if (category === EMPTY_STRING) return null

    const currentTimestampStr = this.getCurr(this.pRecordingTimestamp)
    if (currentTimestampStr === EMPTY_STRING) return null
    const currentTimestampNum = Number(currentTimestampStr)
    if (!Number.isFinite(currentTimestampNum)) return null

    const recording = this.getCurr(this.pRecording) || EMPTY_STRING
    const participant = this.getCurr(this.pParticipant) || EMPTY_STRING
    const eyeMovementTypeIndex =
      this.getCurr(this.pEyeMovementTypeIndex) || EMPTY_STRING

    const sampleKey = `${recording}|${participant}`

    // Cache participant key
    if (
      participant !== this.lastParticipantRaw ||
      recording !== this.lastRecordingRaw
    ) {
      this.lastParticipantRaw = participant
      this.lastRecordingRaw = recording
      this.cachedParticipantKey = `${recording} ${participant}`
    }

    this.updateSampleInterval(currentTimestampNum, sampleKey)

    if (
      eyeMovementTypeIndex === this.mEyeMovementTypeIndex &&
      category === this.mCategory
    ) {
      const stimLen = this.cachedStimulusStack.length
      const lastStimulus =
        stimLen > 0 ? this.cachedStimulusStack[stimLen - 1] : EMPTY_STRING

      if (lastStimulus === this.mStimulus) {
        this.mRecordingLast = currentTimestampNum
        this.trackAoiHitsInline()
        this.lastEyeTrackerTimestamp = currentTimestampNum
        this.lastEyeTrackerSampleKey = sampleKey
        return null
      }
    }

    const out = this.deserializeNewSegment(
      currentTimestampNum,
      recording,
      participant,
      eyeMovementTypeIndex,
      category
    )

    this.lastEyeTrackerTimestamp = currentTimestampNum
    this.lastEyeTrackerSampleKey = sampleKey
    return out
  }

  finalize(): DeserializerOutputType {
    if (
      !this.mParticipant ||
      !this.mStimulus ||
      this.mRecordingStart === null ||
      this.lastEyeTrackerTimestamp === null ||
      this.lastEyeTrackerSampleKey === null
    ) {
      return null
    }

    const lastTimestamp = this.lastEyeTrackerTimestamp
    const sampInt = this.sampleIntervals.get(this.lastEyeTrackerSampleKey)

    let correctedEnd = lastTimestamp
    if (sampInt) {
      correctedEnd = lastTimestamp + sampInt / 2
    }

    this.mRecordingLast = correctedEnd
    this.mAoi = this.mAoiHitTracker.size ? [...this.mAoiHitTracker] : null

    const result = this.intervalStack.size
      ? this.createSegmentsForIntervals()
      : this.createSegmentForSingleStimulus()

    return result
  }

  /* ── Segment boundaries ─────────────────────────────────────────── */
  private deserializeNewSegment(
    currentTsNum: number,
    recording: string,
    participantName: string,
    eyeMovementTypeIndex: string,
    category: string
  ): DeserializerOutputType {
    const participantFull = this.cachedParticipantKey
    const sampleKey = `${recording}|${participantName}`
    const sampInt = this.sampleIntervals.get(sampleKey) ?? null

    let correctedStart = currentTsNum
    let midpoint: number | null = null

    if (sampInt && this.lastEyeTrackerTimestamp !== null) {
      const prevTs = this.lastEyeTrackerTimestamp
      const delta = currentTsNum - prevTs
      if (delta <= sampInt * SAMPLE_INTERVAL_TOLERANCE_FACTOR) {
        midpoint = prevTs + delta / 2
        correctedStart = midpoint
      }
    }

    const activeStimuli = this.cachedStimulusStack

    if (activeStimuli.length > 0) {
      const activeStimulus = activeStimuli[activeStimuli.length - 1]
      const intervalStartKey = `${activeStimulus}|${recording}|${participantName}`
      const intervalStartTs = this.intervalStartTimes.get(intervalStartKey)

      if (intervalStartTs !== undefined) {
        const intervalStartNum = intervalStartTs
        const timeDelta = currentTsNum - intervalStartNum
        if (timeDelta > 0 && timeDelta <= 50000) {
          correctedStart = intervalStartNum
          midpoint = null
          this.intervalStartTimes.delete(intervalStartKey)
        }
      }
    }

    const previousSegment = this.getPreviousSegmentWithCorrectedEnd(midpoint)

    if (activeStimuli.length === 0) {
      this.mStimulus = EMPTY_STRING
      return previousSegment
    }

    const newStimulus = activeStimuli[activeStimuli.length - 1]

    // OPTIMIZATION: Only update base times if stimulus actually changed or we have new ones.
    // However, since we are in "New Segment", we must check.
    // Use standard for loop for speed.
    for (let i = 0; i < activeStimuli.length; i++) {
      const stim = activeStimuli[i]
      const key = stim + participantFull
      if (!this.stimuliBaseTimes.has(key)) {
        this.stimuliBaseTimes.set(key, correctedStart)
      }
    }

    /* mutate state for new segment */
    this.mStimulus = newStimulus
    this.mParticipant = participantFull
    this.mRecordingStart = correctedStart
    this.mCategory = category
    this.mAoiHitTracker.clear()
    this.trackAoiHitsInline()

    this.mEyeMovementTypeIndex = eyeMovementTypeIndex
    this.mRecordingLast = currentTsNum

    return previousSegment
  }

  private getPreviousSegmentWithCorrectedEnd(
    midpoint: number | null
  ): DeserializerOutputType {
    if (
      !this.mParticipant ||
      !this.mStimulus ||
      this.mRecordingStart === null ||
      this.mRecordingLast === null ||
      this.mRecordingLast === this.mRecordingStart
    )
      return null

    this.mAoi = this.mAoiHitTracker.size ? [...this.mAoiHitTracker] : null

    const correctedEnd = midpoint || this.mRecordingLast
    const originalEnd = this.mRecordingLast
    this.mRecordingLast = correctedEnd

    const result = this.intervalStack.size
      ? this.createSegmentsForIntervals()
      : this.createSegmentForSingleStimulus()

    this.mRecordingLast = originalEnd
    return result
  }

  /* ── Sample interval learning ───────────────────────────────────── */
  private updateSampleInterval(currentTs: number, sampleKey: string): void {
    if (this.sampleIntervals.has(sampleKey)) return
    if (this.lastEyeTrackerTimestamp === null) return
    if (this.lastEyeTrackerSampleKey !== sampleKey) return

    const delta = currentTs - this.lastEyeTrackerTimestamp
    if (delta >= MIN_SAMPLE_INTERVAL_US && delta <= MAX_SAMPLE_INTERVAL_US) {
      this.sampleIntervals.set(sampleKey, delta)
    }
  }

  /* ── AOI aggregation (INLINED OPTIMIZATION) ────────────────── */
  private trackAoiHitsInline(): void {
    if (this.aoiCount === 0) return
    const names = this.aoiNames
    for (let j = 0; j < this.aoiCount; j++) {
      if (this.currAoi[j] === 1) this.mAoiHitTracker.add(names[j])
    }
  }

  /* ── Segment creation helpers ───────────────────────── */
  private createSegmentsForIntervals(): DeserializerOutputType {
    const segments: DeserializerOutputType = []
    if (this.mRecordingStart === null || this.mRecordingLast === null)
      return null
    const startNum = this.mRecordingStart
    const endNum = this.mRecordingLast

    for (let i = 0; i < this.cachedStimulusStack.length; i++) {
      const stimulus = this.cachedStimulusStack[i]
      const key = stimulus + this.mParticipant
      const baseTime = this.stimuliBaseTimes.get(key) ?? startNum
      const start = (startNum - baseTime) * TIME_MODIFIER
      const end = (endNum - baseTime) * TIME_MODIFIER
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
    if (this.mRecordingStart === null || this.mRecordingLast === null)
      return null
    const key = this.mStimulus + this.mParticipant
    const baseTime = this.stimuliBaseTimes.get(key) ?? this.mRecordingStart
    const start = (this.mRecordingStart - baseTime) * TIME_MODIFIER
    const end = (this.mRecordingLast - baseTime) * TIME_MODIFIER

    return {
      stimulus: this.mStimulus,
      participant: this.mParticipant,
      start: String(start),
      end: String(end),
      category: this.mCategory,
      aoi: this.mAoi,
    }
  }

  /* ── Utility: stimuli & AOI mapping ─────────────────── */
  private constructAoiInfo(
    header: string[]
  ): { start: number; end: number; names: string[] } | null {
    let startIndex = -1
    let endIndex = -1

    for (let i = 0; i < header.length; i++) {
      if (header[i].startsWith(AOI_HIT_PREFIX)) {
        if (startIndex === -1) startIndex = i
        endIndex = i
      }
    }

    if (startIndex === -1) return null

    const aoiNames: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      const h = header[i]
      if (h.startsWith(AOI_HIT_PREFIX)) {
        const fullName = h.substring(AOI_HIT_PREFIX.length, h.length - 1)
        aoiNames.push(fullName.substring(fullName.lastIndexOf(' - ') + 3))
      } else {
        aoiNames.push(EMPTY_STRING)
      }
    }

    return { start: startIndex, end: endIndex, names: aoiNames }
  }

  /* ── Stimulus Updaters ──────────────────────────────────────────── */
  private constructBaseStimulusUpdater() {
    return (): void => {
      const stim = this.getCurr(this.pStimulus)
      if (
        stim &&
        (this.cachedStimulusStack.length !== 1 ||
          this.cachedStimulusStack[0] !== stim)
      ) {
        this.cachedStimulusStack = [stim]
      } else if (!stim && this.cachedStimulusStack.length > 0) {
        this.cachedStimulusStack = []
      }
    }
  }

  private constructIntervalStimulusUpdater(userInput: string) {
    const parts = userInput.split(';')
    const trimmedParts = parts.map(p => p.trim())
    if (trimmedParts.length !== 2 || !trimmedParts[0] || !trimmedParts[1]) {
      throw new Error(`Invalid Tobii interval marker format.`)
    }
    const [startMarker, endMarker] = trimmedParts

    return (): void => {
      const evt = this.getCurr(this.pEvent)
      if (!evt) return

      if (evt.endsWith(startMarker)) {
        const stimulusName = evt
          .substring(0, evt.length - startMarker.length)
          .trimEnd()
        if (!this.intervalStack.has(stimulusName)) {
          this.intervalStack.add(stimulusName)
          const recording = this.getCurr(this.pRecording)
          const participant = this.getCurr(this.pParticipant)
          const key = `${stimulusName}|${recording}|${participant}`
          const tsStr = this.getCurr(this.pRecordingTimestamp)
          if (tsStr !== EMPTY_STRING) {
            const ts = Number(tsStr)
            if (Number.isFinite(ts)) this.intervalStartTimes.set(key, ts)
          }
          this.updateCachedStimulusStack()
        }
      } else if (evt.endsWith(endMarker)) {
        const stimulusName = evt
          .substring(0, evt.length - endMarker.length)
          .trimEnd()
        if (this.intervalStack.delete(stimulusName)) {
          this.updateCachedStimulusStack()
        }
      }
    }
  }

  private constructWebStimulusUpdater() {
    return (): void => {
      if (this.cEventValue === -1) return
      const evt = this.getCurr(this.pEvent)
      if (!evt) return

      const evtValue = this.getCurr(this.pEventValue)

      if (evt === 'URLStart') {
        const url = evtValue
        if (url && !this.intervalStack.has(url)) {
          this.intervalStack.add(url)
          const recording = this.getCurr(this.pRecording)
          const participant = this.getCurr(this.pParticipant)
          const key = `${url}|${recording}|${participant}`
          const tsStr = this.getCurr(this.pRecordingTimestamp)
          if (tsStr !== EMPTY_STRING) {
            const ts = Number(tsStr)
            if (Number.isFinite(ts)) this.intervalStartTimes.set(key, ts)
          }
          this.updateCachedStimulusStack()
        }
      } else if (evt === 'URLEnd') {
        const url = evtValue
        if (url && this.intervalStack.delete(url)) {
          this.updateCachedStimulusStack()
        }
      }
    }
  }

  private findColumnByPrefix(header: string[], prefix: string): number | null {
    for (let i = 0; i < header.length; i++) {
      if (header[i].startsWith(prefix)) return i
    }
    return null
  }
}
