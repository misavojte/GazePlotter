import { AbstractAdapter } from './AbstractAdapter'
import {
  bytesEqual,
  encodeString,
  endsWithBytes,
  lastIndexOfSubarray,
  splitByDelimiterBytes,
  startsWithBytes,
  stripBom,
  trimEndSpaces,
} from '$lib/data/ingest/utils/byteUtils'

const TIME_MODIFIER = 0.001 // µs → ms
const EMPTY_STRING = ''
const EMPTY_KEY = -1
const MASK_64 = (1n << 64n) - 1n
const AOI_HIT_PREFIX = 'AOI hit ['
const EYE_TRACKER_SENSOR = 'Eye Tracker'
const MIN_SAMPLE_INTERVAL_US = 900
const MAX_SAMPLE_INTERVAL_US = 50000
const SAMPLE_INTERVAL_TOLERANCE_FACTOR = 1.5
const WEB_STIMULUS_TRIGGER = 'WebStimulus'

type StimulusPackedCols = {
  pCategory: number
  pCategoryIndex: number
  pMappedFixationX: number
  pMappedFixationY: number
}

class BigIntNumberMap {
  private keys: bigint[]
  private values: Float64Array
  private states: Uint8Array
  private mask: number
  private _size = 0

  constructor(initialCapacity = 64) {
    const cap = this.nextPow2(initialCapacity)
    this.keys = new Array(cap)
    this.values = new Float64Array(cap)
    this.states = new Uint8Array(cap)
    this.mask = cap - 1
  }

  get size(): number {
    return this._size
  }

  has(key: bigint): boolean {
    return this.findExisting(key) !== -1
  }

  get(key: bigint): number | undefined {
    const idx = this.findExisting(key)
    if (idx === -1) return undefined
    return this.values[idx]
  }

  set(key: bigint, value: number): void {
    if ((this._size + 1) * 10 >= this.keys.length * 7) {
      this.rehash(this.keys.length * 2)
    }
    const slot = this.findSlotForInsert(key)
    if (slot.found) {
      this.values[slot.index] = value
      return
    }
    this.keys[slot.index] = key
    this.values[slot.index] = value
    this.states[slot.index] = 1
    this._size++
  }

  delete(key: bigint): boolean {
    const idx = this.findExisting(key)
    if (idx === -1) return false
    this.states[idx] = 2
    this._size--
    return true
  }

  clear(): void {
    this.states.fill(0)
    this._size = 0
  }

  private nextPow2(n: number): number {
    let p = 1
    while (p < n) p <<= 1
    return p
  }

  private hash(key: bigint): number {
    let h = Number(key & 0xffffffffn)
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
    h ^= Number((key >> 32n) & 0xffffffffn)
    h = Math.imul(h ^ (h >>> 16), 0x846ca68b)
    h ^= Number((key >> 64n) & 0xffffffffn)
    return h >>> 0
  }

  private findExisting(key: bigint): number {
    let idx = this.hash(key) & this.mask
    while (this.states[idx] !== 0) {
      if (this.states[idx] === 1 && this.keys[idx] === key) return idx
      idx = (idx + 1) & this.mask
    }
    return -1
  }

  private findSlotForInsert(key: bigint): { index: number; found: boolean } {
    let idx = this.hash(key) & this.mask
    let firstDeleted = -1
    while (this.states[idx] !== 0) {
      if (this.states[idx] === 1 && this.keys[idx] === key) {
        return { index: idx, found: true }
      }
      if (firstDeleted === -1 && this.states[idx] === 2) firstDeleted = idx
      idx = (idx + 1) & this.mask
    }
    return { index: firstDeleted !== -1 ? firstDeleted : idx, found: false }
  }

  private rehash(newCapacity: number): void {
    const oldKeys = this.keys
    const oldValues = this.values
    const oldStates = this.states

    const cap = this.nextPow2(newCapacity)
    this.keys = new Array(cap)
    this.values = new Float64Array(cap)
    this.states = new Uint8Array(cap)
    this.mask = cap - 1
    this._size = 0

    for (let i = 0; i < oldKeys.length; i++) {
      if (oldStates[i] !== 1) continue
      this.set(oldKeys[i], oldValues[i])
    }
  }
}

export class TobiiAdapter extends AbstractAdapter {
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
  /* ── Spatial coordinate columns with fallback ─────────────────────
   * Priority: Mapped fixation [stimulus-specific] → Fixation point [generic].
   * Tobii data already maps fixations per stimulus/participant/segment boundary,
   * so no per-row aggregation needed; first non-NaN coordinate pair is captured.
   */
  private readonly cMappedFixationX: number | null
  private readonly cMappedFixationY: number | null
  private readonly cFixationX: number
  private readonly cFixationY: number
  // Multiplier that converts the file's `Recording timestamp` into microseconds.
  // Older Tobii Pro Lab versions exported microseconds without a unit suffix;
  // newer versions can label the column `[μs]` or `[ms]`. Internal logic is
  // microsecond-based, so `[ms]` files are scaled at read time.
  private readonly recordingTimestampScaleToMicros: number
  // Unmapped (generic) fallbacks for category/index. Non-null only when the
  // file ALSO has per-stimulus `Mapped eye movement type [...]` columns, so the
  // unmapped column is a distinct fallback. When the file has only the unmapped
  // column, cCategory already points there and these stay -1.
  private readonly cCategoryUnmapped: number
  private readonly cEyeMovementTypeIndexUnmapped: number

  private readonly pRecordingTimestamp = 0
  private readonly pStimulus = 1
  private readonly pParticipant = 2
  private readonly pRecording = 3
  private readonly pCategory = 4
  private readonly pEvent = 5
  private readonly pEventValue = 6
  private readonly pEyeMovementTypeIndex = 7
  private readonly pSensor = 8
  private readonly pMappedFixationX = 9
  private readonly pMappedFixationY = 10
  private readonly pFixationX = 11
  private readonly pFixationY = 12
  private readonly pCategoryUnmapped = 13
  private readonly pEyeMovementTypeIndexUnmapped = 14

  // Per-stimulus packed-column overrides, keyed by FNV hash of the stimulus name.
  // Tobii exports may carry one set of `Mapped eye movement type / index / fixation X/Y`
  // columns per stimulus; the relevant column is non-empty only while that stimulus is
  // active. Falls back to the first-mapped/unmapped pCategory etc. when no override.
  private readonly stimulusPackedCols = new Map<number, StimulusPackedCols>()
  private activeStimulusPackedCols: StimulusPackedCols | null = null
  // Media-name parsing must never read per-stimulus mapped columns: those are
  // keyed to interval names, not to media files, so they're meaningless here.
  // Set in the constructor when the base/media stimulus updater is selected.
  private mappedColumnsAllowed = true

  /* ── Optimized AOI Info ─────────────────────────────────────────── */
  private readonly aoiNames: Uint8Array[] = []
  private readonly hasSensorColumn: boolean

  /* ── Mutable segment state ──────────────────────────────────────── */
  private mStimulusBytes: Uint8Array | null = null
  private mParticipantBytes: Uint8Array | null = null
  private mStimulusKey = EMPTY_KEY
  private mParticipantKey: bigint | null = null
  private mRecordingStart: number | null = null
  private mEyeMovementTypeIndexBytes: Uint8Array | null = null
  private mRecordingLast: number | null = null
  private mCategoryBytes: Uint8Array | null = null
  private mCategoryId = 0
  private mAoi: Uint8Array[] | null = null
  // Snapshot of the interval stack at the moment the current segment started.
  // Used when emitting that segment so it isn't mis-attributed if IntervalEnd_A
  // and IntervalStart_B both arrive before the next eye-tracker sample.
  private mActiveStimuliBytes: Uint8Array[] = []
  private mActiveStimuliKeys: number[] = []
  private aoiHitFlags: Uint8Array = new Uint8Array(0)
  private aoiHitCount = 0
  /* ── Spatial segment state ──────────────────────────────────────── */
  private mSegmentSpatialX: number | null = null
  private mSegmentSpatialY: number | null = null

  // Last processed Eye Tracker row (not necessarily the previous input row).
  // Tobii exports can interleave IntervalStart/IntervalEnd events between samples.
  private lastEyeTrackerTimestamp: number | null = null
  private lastEyeTrackerSampleKey: bigint | null = null

  /* ── Sampling interval learning ─────────────────────────────────── */
  private readonly sampleIntervals = new BigIntNumberMap(256)

  /* ── Stimulus helpers ───────────────────────────────────────────── */
  private readonly stimulusUpdater: () => void
  private cachedStimulusStackBytes: Uint8Array[] = []
  private cachedStimulusStackKeys: number[] = []

  private readonly stimuliBaseTimes = new BigIntNumberMap(512)
  private readonly intervalStack: Map<number, Uint8Array> = new Map()
  private readonly intervalStartTimes = new BigIntNumberMap(256)

  /* ── Optimization Caches ────────────────────────────────────────── */
  private cachedParticipantKey: bigint | null = null
  private lastParticipantKey = 0
  private lastRecordingKey = 0
  private lastParticipantBytes: Uint8Array | null = null
  private lastRecordingBytes: Uint8Array | null = null

  private readonly eyeTrackerSensorBytes: Uint8Array
  private readonly urlStartBytes: Uint8Array
  private readonly urlEndBytes: Uint8Array
  private readonly aoiHitPrefixBytes: Uint8Array
  private readonly aoiHitSuffixBytes: Uint8Array
  private readonly aoiDashBytes: Uint8Array
  private readonly fixationBytes: Uint8Array
  private readonly spaceBytes: Uint8Array

  static readonly TYPE = 'tobii'

  constructor(
    header: string[],
    userInput: string,
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8',
    headerBytes?: Uint8Array
  ) {
    super(columnDelimiter, encoding)
    this.eyeTrackerSensorBytes = encodeString(EYE_TRACKER_SENSOR, this.encoding)
    this.urlStartBytes = encodeString('URLStart', this.encoding)
    this.urlEndBytes = encodeString('URLEnd', this.encoding)
    this.aoiHitPrefixBytes = encodeString(AOI_HIT_PREFIX, this.encoding)
    this.aoiHitSuffixBytes = encodeString(']', this.encoding)
    this.aoiDashBytes = encodeString(' - ', this.encoding)
    this.fixationBytes = encodeString('Fixation', this.encoding)
    this.spaceBytes = encodeString(' ', this.encoding)
    this.cRecordingTimestamp = this.findColumnByNameOrUnit(
      header,
      'Recording timestamp'
    )
    this.recordingTimestampScaleToMicros = this.detectMicrosecondScale(
      this.cRecordingTimestamp !== -1 ? header[this.cRecordingTimestamp] : ''
    )
    const altStim = header.indexOf('Presented Stimulus name')
    this.cStimulus =
      altStim === -1 ? header.indexOf('Recording media name') : altStim
    this.cParticipant = header.indexOf('Participant name')
    this.cRecording = header.indexOf('Recording name')
    const cCategoryUnmappedRaw = header.indexOf('Eye movement type')
    const cCategoryFirstMapped = this.findColumnByPrefix(
      header,
      'Mapped eye movement type'
    )
    this.cCategory = cCategoryFirstMapped ?? cCategoryUnmappedRaw
    // Track the unmapped column separately only when it's distinct from cCategory,
    // so the deserializer can fall back to it when the mapped column is empty.
    this.cCategoryUnmapped =
      cCategoryFirstMapped !== null && cCategoryUnmappedRaw !== -1
        ? cCategoryUnmappedRaw
        : -1
    this.cEvent = header.indexOf('Event')
    this.cEventValue = header.indexOf('Event value')
    const cEyeMovementTypeIndexUnmappedRaw = header.indexOf(
      'Eye movement type index'
    )
    const cEyeMovementTypeIndexFirstMapped = this.findColumnByPrefix(
      header,
      'Mapped eye movement type index'
    )
    this.cEyeMovementTypeIndex =
      cEyeMovementTypeIndexFirstMapped ?? cEyeMovementTypeIndexUnmappedRaw
    this.cEyeMovementTypeIndexUnmapped =
      cEyeMovementTypeIndexFirstMapped !== null &&
      cEyeMovementTypeIndexUnmappedRaw !== -1
        ? cEyeMovementTypeIndexUnmappedRaw
        : -1
    this.cSensor = header.indexOf('Sensor')

    /* Initialize spatial column indices with fallback support */
    this.cMappedFixationX = this.findColumnByPrefix(header, 'Mapped fixation X')
    this.cMappedFixationY = this.findColumnByPrefix(header, 'Mapped fixation Y')
    this.cFixationX = this.findColumnByNameOrUnit(header, 'Fixation point X')
    this.cFixationY = this.findColumnByNameOrUnit(header, 'Fixation point Y')

    this.hasSensorColumn = this.cSensor !== -1

    const baseColumns: number[] = [
      this.cRecordingTimestamp,
      this.cStimulus,
      this.cParticipant,
      this.cRecording,
      this.cCategory,
      this.cEvent,
      this.cEventValue,
      this.cEyeMovementTypeIndex,
      this.cSensor,
      this.cMappedFixationX ?? -1,
      this.cMappedFixationY ?? -1,
      this.cFixationX,
      this.cFixationY,
      this.cCategoryUnmapped,
      this.cEyeMovementTypeIndexUnmapped,
    ]

    const mappedCategoryByStim = this.collectColumnsByBracketedSuffix(
      header,
      'Mapped eye movement type ['
    )
    const mappedCategoryIndexByStim = this.collectColumnsByBracketedSuffix(
      header,
      'Mapped eye movement type index ['
    )
    const mappedFixXByStim = this.collectColumnsByBracketedSuffix(
      header,
      'Mapped fixation X ['
    )
    const mappedFixYByStim = this.collectColumnsByBracketedSuffix(
      header,
      'Mapped fixation Y ['
    )

    const stimNames = new Set<string>([
      ...mappedCategoryByStim.keys(),
      ...mappedCategoryIndexByStim.keys(),
      ...mappedFixXByStim.keys(),
      ...mappedFixYByStim.keys(),
    ])
    for (const stimName of stimNames) {
      const stimKey = this.makeKey(encodeString(stimName, this.encoding))
      const cols: StimulusPackedCols = {
        pCategory: baseColumns.length,
        pCategoryIndex: baseColumns.length + 1,
        pMappedFixationX: baseColumns.length + 2,
        pMappedFixationY: baseColumns.length + 3,
      }
      baseColumns.push(
        mappedCategoryByStim.get(stimName) ?? -1,
        mappedCategoryIndexByStim.get(stimName) ?? -1,
        mappedFixXByStim.get(stimName) ?? -1,
        mappedFixYByStim.get(stimName) ?? -1
      )
      this.stimulusPackedCols.set(stimKey, cols)
    }

    this.setupColumns(baseColumns)

    const aoiInfo = headerBytes
      ? this.constructAoiInfoFromBytes(headerBytes)
      : this.constructAoiInfo(header)
    if (aoiInfo) {
      this.aoiNames.push(...aoiInfo.names)
      this.setupAoiColumns(aoiInfo.start, aoiInfo.names.length)
      this.aoiHitFlags = new Uint8Array(aoiInfo.names.length)
    }

    if (userInput === WEB_STIMULUS_TRIGGER) {
      this.stimulusUpdater = this.constructWebStimulusUpdaterBinary()
    } else if (userInput === EMPTY_STRING) {
      this.mappedColumnsAllowed = false
      this.stimulusUpdater = this.constructBaseStimulusUpdaterBinary()
    } else {
      this.stimulusUpdater = this.constructIntervalStimulusUpdaterBinary(
        userInput
      )
    }
  }

  /* ── Helpers ────────────────────────────────────────────────────── */

  private updateCachedStimulusStackBinary(): void {
    if (!this.intervalStack.size) {
      this.cachedStimulusStackBytes = []
      this.cachedStimulusStackKeys = []
      this.activeStimulusPackedCols = null
      return
    }
    this.cachedStimulusStackBytes = Array.from(this.intervalStack.values())
    this.cachedStimulusStackKeys = Array.from(this.intervalStack.keys())
    const lastKey =
      this.cachedStimulusStackKeys[this.cachedStimulusStackKeys.length - 1]
    this.activeStimulusPackedCols =
      this.stimulusPackedCols.get(lastKey) ?? null
  }

  /* ── Spatial coordinate extraction ──────────────────────────────── */
  /**
   * Extract spatial coordinates with priority fallback.
   * Priority: Mapped fixation X/Y (stimulus-specific) → Fixation point X/Y (generic).
   * Returns { x, y } | null if valid pair found.
   */
  private getSpatialCoordinates(): { x: number; y: number } | null {
    let x: number
    let y: number

    if (this.mappedColumnsAllowed) {
      // Try the active stimulus's mapped fixation columns first
      const active = this.activeStimulusPackedCols
      if (active) {
        x = this.getNumber(active.pMappedFixationX)
        y = this.getNumber(active.pMappedFixationY)
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return { x, y }
        }
      }

      // Fallback to first-mapped fixation columns (legacy single-stimulus path)
      if (this.cMappedFixationX !== null && this.cMappedFixationY !== null) {
        x = this.getNumber(this.pMappedFixationX)
        y = this.getNumber(this.pMappedFixationY)
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return { x, y }
        }
      }
    }

    // Fallback to standard fixation point coordinates (also the only path in
    // media mode, where mapped fixations don't apply to media-named stimuli)
    x = this.getNumber(this.pFixationX)
    y = this.getNumber(this.pFixationY)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y }
    }

    // No valid coordinate pair found
    return null
  }

  /**
   * Update segment spatial state with first non-null coordinate pair.
   * Called during row deserialization; only captures coordinates once per segment.
   */
  private updateSegmentSpatial(): void {
    // Only set spatial if not already set in this segment (capture first valid pair)
    if (this.mSegmentSpatialX === null && this.mSegmentSpatialY === null) {
      const spatial = this.getSpatialCoordinates()
      if (spatial) {
        this.mSegmentSpatialX = spatial.x
        this.mSegmentSpatialY = spatial.y
      }
    }
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    this.stimulusUpdater()

    let categoryBytes: Uint8Array
    let eyeMovementTypeIndexBytes: Uint8Array
    if (this.mappedColumnsAllowed) {
      const active = this.activeStimulusPackedCols
      categoryBytes = active
        ? this.getBytes(active.pCategory)
        : new Uint8Array(0)
      if (!categoryBytes.length) categoryBytes = this.getBytes(this.pCategory)
      if (!categoryBytes.length && this.cCategoryUnmapped !== -1) {
        categoryBytes = this.getBytes(this.pCategoryUnmapped)
      }
    } else {
      // Media mode: ignore mapped columns; per-stimulus mappings are tied to
      // interval names, not media files, so they can't carry valid data here.
      categoryBytes =
        this.cCategoryUnmapped !== -1
          ? this.getBytes(this.pCategoryUnmapped)
          : this.getBytes(this.pCategory)
    }
    if (!categoryBytes.length) return

    if (this.hasSensorColumn) {
      const sensorBytes = this.getBytes(this.pSensor)
      if (!bytesEqual(sensorBytes, this.eyeTrackerSensorBytes)) return
    }

    const currentTimestampNum = this.getRecordingTimestampMicros()
    if (!Number.isFinite(currentTimestampNum)) return

    const recordingBytes = this.getBytes(this.pRecording)
    const participantBytes = this.getBytes(this.pParticipant)
    if (this.mappedColumnsAllowed) {
      const active = this.activeStimulusPackedCols
      eyeMovementTypeIndexBytes = active
        ? this.getBytes(active.pCategoryIndex)
        : new Uint8Array(0)
      if (!eyeMovementTypeIndexBytes.length) {
        eyeMovementTypeIndexBytes = this.getBytes(this.pEyeMovementTypeIndex)
      }
      if (
        !eyeMovementTypeIndexBytes.length &&
        this.cEyeMovementTypeIndexUnmapped !== -1
      ) {
        eyeMovementTypeIndexBytes = this.getBytes(
          this.pEyeMovementTypeIndexUnmapped
        )
      }
    } else {
      eyeMovementTypeIndexBytes =
        this.cEyeMovementTypeIndexUnmapped !== -1
          ? this.getBytes(this.pEyeMovementTypeIndexUnmapped)
          : this.getBytes(this.pEyeMovementTypeIndex)
    }

    const recordingChanged = !bytesEqual(
      recordingBytes,
      this.lastRecordingBytes
    )
    const participantChanged = !bytesEqual(
      participantBytes,
      this.lastParticipantBytes
    )

    if (recordingChanged) {
      this.lastRecordingBytes = recordingBytes.length ? recordingBytes : null
      this.lastRecordingKey = this.makeKey(recordingBytes)
    }

    if (participantChanged) {
      this.lastParticipantBytes = participantBytes.length
        ? participantBytes
        : null
      this.lastParticipantKey = this.makeKey(participantBytes)
    }

    if (
      recordingChanged ||
      participantChanged ||
      this.cachedParticipantKey === null
    ) {
      this.cachedParticipantKey = this.makeCompositeKey64(
        this.lastRecordingKey,
        this.lastParticipantKey
      )
    }

    const recordingKey = this.lastRecordingKey
    const participantKey = this.lastParticipantKey
    const sampleKey =
      this.cachedParticipantKey ??
      this.makeCompositeKey64(recordingKey, participantKey)

    this.updateSampleInterval(currentTimestampNum, sampleKey)

    if (
      this.mEyeMovementTypeIndexBytes &&
      this.mCategoryBytes &&
      bytesEqual(eyeMovementTypeIndexBytes, this.mEyeMovementTypeIndexBytes) &&
      bytesEqual(categoryBytes, this.mCategoryBytes)
    ) {
      const stimLen = this.cachedStimulusStackKeys.length
      const lastStimulusKey =
        stimLen > 0 ? this.cachedStimulusStackKeys[stimLen - 1] : EMPTY_KEY

      if (lastStimulusKey === this.mStimulusKey) {
        this.mRecordingLast = currentTimestampNum
        this.trackAoiHitsInline()
        this.updateSegmentSpatial()
        this.lastEyeTrackerTimestamp = currentTimestampNum
        this.lastEyeTrackerSampleKey = sampleKey
        return
      }
    }

    this.deserializeNewSegment(
      currentTimestampNum,
      recordingBytes,
      recordingKey,
      participantBytes,
      participantKey,
      eyeMovementTypeIndexBytes,
      categoryBytes
    )

    this.lastEyeTrackerTimestamp = currentTimestampNum
    this.lastEyeTrackerSampleKey = sampleKey
    return
  }

  finalize(): void {
    if (
      !this.mParticipantBytes ||
      !this.mStimulusBytes ||
      this.mRecordingStart === null ||
      this.lastEyeTrackerTimestamp === null ||
      this.lastEyeTrackerSampleKey === null
    ) {
      return
    }

    const lastTimestamp = this.lastEyeTrackerTimestamp
    const sampInt = this.sampleIntervals.get(this.lastEyeTrackerSampleKey)

    let correctedEnd = lastTimestamp
    if (sampInt) {
      correctedEnd = lastTimestamp + sampInt / 2
    }

    this.mRecordingLast = correctedEnd
    this.mAoi = this.buildAoiListFromFlags()

    if (this.intervalStack.size) this.createSegmentsForIntervals()
    else this.createSegmentForSingleStimulus()
    return
  }

  /* ── Segment boundaries ─────────────────────────────────────────── */
  private deserializeNewSegment(
    currentTsNum: number,
    recordingBytes: Uint8Array,
    recordingKey: number,
    participantBytes: Uint8Array,
    participantKey: number,
    eyeMovementTypeIndexBytes: Uint8Array,
    categoryBytes: Uint8Array
  ): void {
    const participantFull =
      this.cachedParticipantKey ??
      this.makeCompositeKey64(recordingKey, participantKey)
    const sampleKey = this.makeCompositeKey64(recordingKey, participantKey)
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

    const activeStimuliBytes = this.cachedStimulusStackBytes
    const activeStimuliKeys = this.cachedStimulusStackKeys

    if (activeStimuliBytes.length > 0) {
      const activeStimulusKey = activeStimuliKeys[activeStimuliKeys.length - 1]
      const intervalStartKey = this.makeCompositeKey96(
        activeStimulusKey,
        recordingKey,
        participantKey
      )
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

    this.getPreviousSegmentWithCorrectedEnd(midpoint)

    if (activeStimuliBytes.length === 0) {
      this.mStimulusKey = EMPTY_KEY
      this.mStimulusBytes = null
      return
    }

    const newStimulusBytes = activeStimuliBytes[activeStimuliBytes.length - 1]
    const newStimulusKey = activeStimuliKeys[activeStimuliKeys.length - 1]

    // OPTIMIZATION: Only update base times if stimulus actually changed or we have new ones.
    // However, since we are in "New Segment", we must check.
    // Use standard for loop for speed.
    for (let i = 0; i < activeStimuliKeys.length; i++) {
      const stimKey = activeStimuliKeys[i]
      const key = this.makeCompositeKey32x64(stimKey, participantFull)
      if (!this.stimuliBaseTimes.has(key)) {
        this.stimuliBaseTimes.set(key, correctedStart)
      }
    }

    /* mutate state for new segment */
    this.mStimulusBytes = newStimulusBytes
    this.mStimulusKey = newStimulusKey
    this.mActiveStimuliBytes = activeStimuliBytes.slice()
    this.mActiveStimuliKeys = activeStimuliKeys.slice()

    const fullParticipantBytes = new Uint8Array(
      recordingBytes.length + this.spaceBytes.length + participantBytes.length
    )
    fullParticipantBytes.set(recordingBytes, 0)
    fullParticipantBytes.set(this.spaceBytes, recordingBytes.length)
    fullParticipantBytes.set(
      participantBytes,
      recordingBytes.length + this.spaceBytes.length
    )
    this.mParticipantBytes = fullParticipantBytes

    this.mParticipantKey = participantFull
    this.mRecordingStart = correctedStart
    this.mCategoryBytes = categoryBytes
    this.mCategoryId = this.getCategoryId(categoryBytes)
    if (this.aoiHitFlags.length) this.aoiHitFlags.fill(0)
    this.aoiHitCount = 0
    /* Reset spatial state for new segment */
    this.mSegmentSpatialX = null
    this.mSegmentSpatialY = null
    this.trackAoiHitsInline()
    this.updateSegmentSpatial()

    this.mEyeMovementTypeIndexBytes = eyeMovementTypeIndexBytes
    this.mRecordingLast = currentTsNum
  }

  private getPreviousSegmentWithCorrectedEnd(midpoint: number | null): void {
    if (
      !this.mParticipantBytes ||
      !this.mStimulusBytes ||
      this.mRecordingStart === null ||
      this.mRecordingLast === null ||
      this.mRecordingLast === this.mRecordingStart
    )
      return

    this.mAoi = this.buildAoiListFromFlags()

    const correctedEnd = midpoint || this.mRecordingLast
    const originalEnd = this.mRecordingLast
    this.mRecordingLast = correctedEnd

    if (this.intervalStack.size) this.createSegmentsForIntervals()
    else this.createSegmentForSingleStimulus()

    this.mRecordingLast = originalEnd
    return
  }

  /* ── Sample interval learning ───────────────────────────────────── */
  private updateSampleInterval(currentTs: number, sampleKey: bigint): void {
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
      if (this.currAoi[j] === 1) {
        const nameBytes = names[j]
        if (!nameBytes || !nameBytes.length) continue
        if (this.aoiHitFlags[j] === 0) {
          this.aoiHitFlags[j] = 1
          this.aoiHitCount++
        }
      }
    }
  }

  private buildAoiListFromFlags(): Uint8Array[] | null {
    if (this.aoiHitCount === 0) return null
    const out: Uint8Array[] = []
    for (let i = 0; i < this.aoiHitFlags.length; i++) {
      if (this.aoiHitFlags[i] === 1) out.push(this.aoiNames[i])
    }
    return out.length ? out : null
  }

  /* ── Segment creation helpers ───────────────────────── */
  private createSegmentsForIntervals(): void {
    if (this.mRecordingStart === null || this.mRecordingLast === null) return
    const startNum = this.mRecordingStart
    const endNum = this.mRecordingLast

    // Use the stack snapshot taken when this segment began. Falls back to the
    // current stack when no snapshot was captured (e.g. finalize() with active
    // intervals).
    const stimuliBytes = this.mActiveStimuliBytes.length
      ? this.mActiveStimuliBytes
      : this.cachedStimulusStackBytes
    const stimuliKeys = this.mActiveStimuliKeys.length
      ? this.mActiveStimuliKeys
      : this.cachedStimulusStackKeys

    for (let i = 0; i < stimuliBytes.length; i++) {
      const stimulusBytes = stimuliBytes[i]
      const stimulusKey = stimuliKeys[i]
      if (this.mParticipantKey === null) continue
      const key = this.makeCompositeKey32x64(stimulusKey, this.mParticipantKey)
      const baseTime = this.stimuliBaseTimes.get(key) ?? startNum
      const start = (startNum - baseTime) * TIME_MODIFIER
      const end = (endNum - baseTime) * TIME_MODIFIER
      if (!this.mParticipantBytes) continue
      const spatial: { x: number; y: number } | null =
        this.mSegmentSpatialX !== null && this.mSegmentSpatialY !== null
          ? { x: this.mSegmentSpatialX, y: this.mSegmentSpatialY }
          : null
      this.emitSegment(
        start,
        end,
        this.mCategoryId,
        stimulusBytes,
        this.mParticipantBytes,
        this.mAoi,
        spatial
      )
    }
    return
  }

  private createSegmentForSingleStimulus(): void {
    if (this.mRecordingStart === null || this.mRecordingLast === null) return
    if (!this.mStimulusBytes || !this.mParticipantBytes) return
    if (this.mParticipantKey === null) return
    const key = this.makeCompositeKey32x64(
      this.mStimulusKey,
      this.mParticipantKey
    )
    const baseTime = this.stimuliBaseTimes.get(key) ?? this.mRecordingStart
    const start = (this.mRecordingStart - baseTime) * TIME_MODIFIER
    const end = (this.mRecordingLast - baseTime) * TIME_MODIFIER
    const spatial: { x: number; y: number } | null =
      this.mSegmentSpatialX !== null && this.mSegmentSpatialY !== null
        ? { x: this.mSegmentSpatialX, y: this.mSegmentSpatialY }
        : null
    this.emitSegment(
      start,
      end,
      this.mCategoryId,
      this.mStimulusBytes,
      this.mParticipantBytes,
      this.mAoi,
      spatial
    )
    return
  }

  /* ── Utility: stimuli & AOI mapping ─────────────────── */
  private constructAoiInfo(
    header: string[]
  ): { start: number; end: number; names: Uint8Array[] } | null {
    let startIndex = -1
    let endIndex = -1

    for (let i = 0; i < header.length; i++) {
      if (header[i].startsWith(AOI_HIT_PREFIX)) {
        if (startIndex === -1) startIndex = i
        endIndex = i
      }
    }

    if (startIndex === -1) return null

    const aoiNames: Uint8Array[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      const h = header[i]
      if (h.startsWith(AOI_HIT_PREFIX)) {
        const fullName = h.substring(AOI_HIT_PREFIX.length, h.length - 1)
        const name = fullName.substring(fullName.lastIndexOf(' - ') + 3)
        aoiNames.push(encodeString(name, this.encoding))
      } else {
        aoiNames.push(new Uint8Array(0))
      }
    }

    return { start: startIndex, end: endIndex, names: aoiNames }
  }

  private constructAoiInfoFromBytes(
    headerBytes: Uint8Array
  ): { start: number; end: number; names: Uint8Array[] } | null {
    const normalized = stripBom(headerBytes, this.encoding)
    const delimiterBytes = encodeString(this.delim, this.encoding)
    const columns = splitByDelimiterBytes(normalized, delimiterBytes)

    let startIndex = -1
    let endIndex = -1
    const namesByIndex = new Map<number, Uint8Array>()

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      if (!startsWithBytes(column, this.aoiHitPrefixBytes)) continue
      if (startIndex === -1) startIndex = i
      endIndex = i

      let inner = column.subarray(this.aoiHitPrefixBytes.length)
      if (endsWithBytes(inner, this.aoiHitSuffixBytes)) {
        inner = inner.subarray(0, inner.length - this.aoiHitSuffixBytes.length)
      }
      const dashIndex = lastIndexOfSubarray(inner, this.aoiDashBytes)
      if (dashIndex !== -1) {
        inner = inner.subarray(dashIndex + this.aoiDashBytes.length)
      }
      const nameBytes = inner
      namesByIndex.set(i, nameBytes)
    }

    if (startIndex === -1) return null

    const aoiNames: Uint8Array[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      aoiNames.push(namesByIndex.get(i) ?? new Uint8Array(0))
    }

    return { start: startIndex, end: endIndex, names: aoiNames }
  }

  /* ── Stimulus Updaters ──────────────────────────────────────────── */
  private constructBaseStimulusUpdaterBinary() {
    // Media-name stimulus parsing: don't activate per-stimulus mapped columns.
    // Mapped fixation/category columns are keyed by interval names (e.g. `01-walk`),
    // which don't correspond to media file names — keep the standard fallback path.
    return (): void => {
      const stimBytes = this.getBytes(this.pStimulus)
      if (stimBytes.length) {
        const key = this.makeKey(stimBytes)
        if (
          this.cachedStimulusStackBytes.length !== 1 ||
          this.cachedStimulusStackKeys[0] !== key
        ) {
          this.cachedStimulusStackBytes = [stimBytes]
          this.cachedStimulusStackKeys = [key]
        }
      } else if (this.cachedStimulusStackBytes.length > 0) {
        this.cachedStimulusStackBytes = []
        this.cachedStimulusStackKeys = []
      }
    }
  }

  private constructIntervalStimulusUpdaterBinary(userInput: string) {
    const parts = userInput.split(';')
    const trimmedParts = parts.map(p => p.trim())
    if (trimmedParts.length !== 2 || !trimmedParts[0] || !trimmedParts[1]) {
      throw new Error(`Invalid Tobii interval marker format.`)
    }
    const [startMarker, endMarker] = trimmedParts
    const startMarkerBytes = encodeString(startMarker, this.encoding)
    const endMarkerBytes = encodeString(endMarker, this.encoding)

    return (): void => {
      const evtBytes = this.getBytes(this.pEvent)
      if (!evtBytes.length) return

      if (endsWithBytes(evtBytes, startMarkerBytes)) {
        const rawStimBytes = trimEndSpaces(
          evtBytes.subarray(0, evtBytes.length - startMarkerBytes.length),
          this.encoding
        )
        const stimKey = this.makeKey(rawStimBytes)
        if (!this.intervalStack.has(stimKey)) {
          this.intervalStack.set(stimKey, rawStimBytes)
          const recordingKey = this.makeKey(this.getBytes(this.pRecording))
          const participantKey = this.makeKey(this.getBytes(this.pParticipant))
          const key = this.makeCompositeKey96(
            stimKey,
            recordingKey,
            participantKey
          )
          const tsNum = this.getRecordingTimestampMicros()
          if (Number.isFinite(tsNum)) this.intervalStartTimes.set(key, tsNum)
          this.updateCachedStimulusStackBinary()
        }
      } else if (endsWithBytes(evtBytes, endMarkerBytes)) {
        const rawStimBytes = trimEndSpaces(
          evtBytes.subarray(0, evtBytes.length - endMarkerBytes.length),
          this.encoding
        )
        const stimKey = this.makeKey(rawStimBytes)
        if (this.intervalStack.delete(stimKey)) {
          this.updateCachedStimulusStackBinary()
        }
      }
    }
  }

  private constructWebStimulusUpdaterBinary() {
    return (): void => {
      if (this.cEventValue === -1) return
      const evtBytes = this.getBytes(this.pEvent)
      if (!evtBytes.length) return

      const evtValueBytes = this.getBytes(this.pEventValue)

      if (bytesEqual(evtBytes, this.urlStartBytes)) {
        const urlKey = this.makeKey(evtValueBytes)
        if (!this.intervalStack.has(urlKey)) {
          this.intervalStack.set(urlKey, evtValueBytes)
          const recordingKey = this.makeKey(this.getBytes(this.pRecording))
          const participantKey = this.makeKey(this.getBytes(this.pParticipant))
          const key = this.makeCompositeKey96(
            urlKey,
            recordingKey,
            participantKey
          )
          const tsNum = this.getRecordingTimestampMicros()
          if (Number.isFinite(tsNum)) this.intervalStartTimes.set(key, tsNum)
          this.updateCachedStimulusStackBinary()
        }
      } else if (bytesEqual(evtBytes, this.urlEndBytes)) {
        const urlKey = this.makeKey(evtValueBytes)
        if (this.intervalStack.delete(urlKey)) {
          this.updateCachedStimulusStackBinary()
        }
      }
    }
  }

  private makeKey(bytes: Uint8Array): number {
    let hash = 2166136261
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i]
      hash = Math.imul(hash, 16777619)
    }
    hash ^= bytes.length
    hash = Math.imul(hash, 16777619)
    return hash >>> 0
  }

  private makeCompositeKey64(a: number, b: number): bigint {
    return (BigInt(a >>> 0) << 32n) | BigInt(b >>> 0)
  }

  private makeCompositeKey96(a: number, b: number, c: number): bigint {
    return (BigInt(a >>> 0) << 64n) | (BigInt(b >>> 0) << 32n) | BigInt(c >>> 0)
  }

  private makeCompositeKey32x64(a: number, b: bigint): bigint {
    return (BigInt(a >>> 0) << 64n) | (b & MASK_64)
  }

  private getCategoryId(categoryBytes: Uint8Array): number {
    return bytesEqual(categoryBytes, this.fixationBytes) ? 0 : 1
  }

  private findColumnByPrefix(header: string[], prefix: string): number | null {
    for (let i = 0; i < header.length; i++) {
      if (header[i].startsWith(prefix)) return i
    }
    return null
  }

  /**
   * Read the recording timestamp from the current row, returning microseconds
   * regardless of the source file's labelled unit (`[μs]` vs `[ms]`).
   */
  private getRecordingTimestampMicros(): number {
    return (
      this.getNumber(this.pRecordingTimestamp) *
      this.recordingTimestampScaleToMicros
    )
  }

  /**
   * Pick the µs scale factor from a `Recording timestamp` header cell. Bare
   * `Recording timestamp` and `Recording timestamp [μs]` both mean
   * microseconds (factor 1); `Recording timestamp [ms]` means milliseconds
   * (factor 1000). Anything else also defaults to 1 — Tobii Pro Lab is not
   * known to export `Recording timestamp` in any other unit.
   */
  private detectMicrosecondScale(headerCell: string): number {
    const open = headerCell.lastIndexOf('[')
    if (open === -1 || !headerCell.endsWith(']')) return 1
    const unit = headerCell.substring(open + 1, headerCell.length - 1).trim()
    return unit === 'ms' ? 1000 : 1
  }

  /**
   * Resolve a header cell by exact name OR by `name [<unit>]`. Newer Tobii Pro
   * Lab exports add unit suffixes (e.g. `Recording timestamp [ms]`,
   * `Fixation point X [DACS px]`) to quantitative columns. Returns -1 if
   * neither form is found.
   */
  private findColumnByNameOrUnit(header: string[], name: string): number {
    const exact = header.indexOf(name)
    if (exact !== -1) return exact
    const prefix = name + ' ['
    for (let i = 0; i < header.length; i++) {
      const h = header[i]
      if (h.startsWith(prefix) && h.endsWith(']')) return i
    }
    return -1
  }

  /**
   * Collect header columns of the form `<prefix><stimName>]` (e.g.
   * `Mapped fixation X [01-walk]`), keyed by the stimulus name inside the
   * brackets. The prefix is expected to end with `[`.
   */
  private collectColumnsByBracketedSuffix(
    header: string[],
    prefix: string
  ): Map<string, number> {
    const result = new Map<string, number>()
    for (let i = 0; i < header.length; i++) {
      const h = header[i]
      if (!h.startsWith(prefix)) continue
      if (!h.endsWith(']')) continue
      const stim = h.substring(prefix.length, h.length - 1)
      if (stim.length === 0) continue
      result.set(stim, i)
    }
    return result
  }
}
