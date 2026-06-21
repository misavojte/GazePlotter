import { SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import type { DataType } from '$lib/data/types'
import { DEFAULT_NO_AOI_TREATMENT } from '$lib/data/types'
import { createDefaultMetricInstances } from '$lib/metrics/instances'
import type { SegmentRow } from '../types'
import type { TextEncoding } from '$lib/data/ingest/utils/byteUtils'
import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'
import { ByteDictionary } from '$lib/data/ingest/utils/byteDictionary'

/** Bucket lifecycle states. See `SegmentBucket.state`. */
const BUCKET_AUTO = 0
const BUCKET_PROVISIONAL = 1
const BUCKET_COMMITTED = 2

/**
 * OPTIMIZED BUCKET
 * Uses Flat Buffers for EVERYTHING. Zero object allocation per row.
 */
class SegmentBucket {
  // [start, end, category] -> Stride of 3
  data: Float64Array

  // Flattened AOI Data
  // aoiCounts[i] = number of AOIs in row i
  // aoiBuffer = contiguous list of AOI IDs
  // aoiOffsets[i] = start index in aoiBuffer for row i
  aoiCounts: Uint8Array
  aoiOffsets: Uint32Array
  aoiBuffer: Uint16Array

  // Optional spatial coordinate storage
  // spatialData[i*2] = x, spatialData[i*2+1] = y; NaN for missing coordinates
  spatialData: Float32Array | null = null
  hasSpatialData = false

  count = 0
  aoiTotalCount = 0 // Pointer for aoiBuffer

  // Group lifecycle. AUTO (0): materialized if count > 0 — the default, so
  // non-gating formats need no calls. PROVISIONAL (1): a gating format opened
  // this group; skipped by buildFinalData unless committed. COMMITTED (2):
  // confirmed valid, materialized like AUTO. See SegmentWriter.beginProvisionalGroup.
  state: 0 | 1 | 2 = 0
  // Index into SegmentWriter.provisional while PROVISIONAL; -1 otherwise.
  handle = -1

  constructor(initialCapacity = 2000) {
    this.data = new Float64Array(initialCapacity * 3)
    this.aoiCounts = new Uint8Array(initialCapacity)
    this.aoiOffsets = new Uint32Array(initialCapacity)
    // Assume average of 1 AOI per row for initial sizing
    this.aoiBuffer = new Uint16Array(initialCapacity)
  }

  add(
    start: number,
    end: number,
    cat: number,
    aois: number[] | null,
    spatial?: { x: number; y: number } | null
  ) {
    // 1. Resize Row Buffers if full
    if (this.count >= this.data.length / 3) {
      const oldLen = this.data.length
      const newLen = oldLen * 2

      const newData = new Float64Array(newLen)
      newData.set(this.data)
      this.data = newData

      // Resize counts/offsets (length matches row count)
      const newCounts = new Uint8Array(newLen / 3)
      newCounts.set(this.aoiCounts)
      this.aoiCounts = newCounts

      const newOffsets = new Uint32Array(newLen / 3)
      newOffsets.set(this.aoiOffsets)
      this.aoiOffsets = newOffsets

      // Resize spatial buffer if allocated
      if (this.spatialData) {
        const newSpatial = new Float32Array(newLen * 2)
        newSpatial.set(this.spatialData)
        // Fill expanded space with NaN
        for (let i = this.spatialData.length; i < newLen * 2; i++) {
          newSpatial[i] = Number.NaN
        }
        this.spatialData = newSpatial
      }
    }

    // 2. Resize AOI Content Buffer if needed
    const aoiLen = aois ? aois.length : 0
    if (this.aoiTotalCount + aoiLen >= this.aoiBuffer.length) {
      const newAoiBuf = new Uint16Array(this.aoiBuffer.length * 2 + aoiLen)
      newAoiBuf.set(this.aoiBuffer)
      this.aoiBuffer = newAoiBuf
    }

    // 3. Write Data
    const ptr = this.count * 3
    this.data[ptr + 0] = start
    this.data[ptr + 1] = end
    this.data[ptr + 2] = cat

    // 4. Write AOIs
    this.aoiCounts[this.count] = aoiLen
    this.aoiOffsets[this.count] = this.aoiTotalCount

    if (aois && aoiLen > 0) {
      for (let i = 0; i < aoiLen; i++) {
        this.aoiBuffer[this.aoiTotalCount++] = aois[i]
      }
    }

    // 5. Write Spatial Data
    if (spatial) {
      // Lazily allocate spatial buffer on first use
      if (!this.spatialData) {
        this.spatialData = new Float32Array(this.data.length)
        // Fill with NaN initially
        for (let i = 0; i < this.spatialData.length; i++) {
          this.spatialData[i] = Number.NaN
        }
        this.hasSpatialData = true
      }
      const spatialPtr = this.count * 2
      this.spatialData[spatialPtr] = spatial.x
      this.spatialData[spatialPtr + 1] = spatial.y
    }

    this.count++
  }

  /**
   * Returns indices sorted by Start Time (O(N log N) but on integers)
   */
  getSortedIndices(): Uint32Array {
    const indices = new Uint32Array(this.count)
    for (let i = 0; i < this.count; i++) indices[i] = i
    const d = this.data
    // Sort based on Start Time (offset 0)
    indices.sort((a, b) => d[a * 3] - d[b * 3])
    return indices
  }
}

/**
 * Accumulates parsed segments (from any number of files and formats) into
 * the final binary `DataType`. The segment backend of `DatasetSink`.
 */
export class SegmentWriter {
  // Metadata
  private stimuli = new ByteDictionary()
  private participants = new ByteDictionary()
  private stimuliBytes: Uint8Array[] = []
  private participantBytes: Uint8Array[] = []

  // Eye-movement categories, interned by DECODED NAME so `categories.data`
  // reflects the types actually present (no phantom "Saccade" for fixation-only
  // data) and preserves distinct source types (Tobii Unclassified/EyesNotFound,
  // GazePoint Blink, …) instead of collapsing them. Fixation is reserved at id 0
  // (FIXATION_CATEGORY_ID), matching the binary/scarf convention. Keying on the
  // string (not raw bytes) keeps identity encoding-independent, so the same type
  // name from files of different encodings in one upload coalesces to one id.
  private categoryIds = new Map<string, number>()
  private categoryNames: string[] = []
  private categorySeeded = false

  // AOI Mapping
  private aoiMaps: ByteDictionary[] = []
  private aoisPerStimulus: Uint8Array[][] = []

  // Data Storage
  private buckets: SegmentBucket[][] = []
  private totalSegments = 0
  private totalAoiHits = 0

  // Provisional groups in handle order: provisional[handle] is the bucket a
  // gating format opened and must commit to keep. Only ever appended to and
  // indexed; never per-row.
  private provisional: SegmentBucket[] = []

  private encoding: TextEncoding = 'utf-8'
  private decoder: TextDecoder = new TextDecoder('utf-8')

  /** Format-provided override for the "no stimuli found" failure message. */
  private emptyDatasetError: string | null = null

  setEncoding(encoding: TextEncoding): void {
    this.encoding = encoding
    this.decoder = new TextDecoder(encoding)
  }

  /**
   * Install a format-specific message thrown when parsing finishes with
   * zero stimuli (e.g. Tobii custom media parsing matched no intervals).
   * Pass null to restore the generic message.
   */
  setEmptyDatasetError(message: string | null): void {
    this.emptyDatasetError = message
  }

  /** Reserve Fixation at id 0 before any other category is interned. */
  private ensureCategorySeed(): void {
    if (this.categorySeeded) return
    this.categoryIds.set('Fixation', 0)
    this.categoryNames.push('Fixation')
    this.categorySeeded = true
  }

  /**
   * Intern an eye-movement-category NAME to a stable id (Fixation reserved at
   * 0). Parsers call this (via `RowParser.resolveCategoryId`, which decodes the
   * source bytes) for every segment's category so `buildFinalData` emits only
   * the categories actually seen, with their real names.
   */
  internCategory(name: string): number {
    this.ensureCategorySeed()
    const existing = this.categoryIds.get(name)
    if (existing !== undefined) return existing
    const id = this.categoryNames.length
    this.categoryIds.set(name, id)
    this.categoryNames.push(name)
    return id
  }

  addSegmentBytes(
    start: number,
    end: number,
    categoryId: number,
    stimulus: Uint8Array,
    participant: Uint8Array,
    aoi: Uint8Array[] | null,
    spatial?: { x: number; y: number } | null
  ): void {
    const sIdx = this.getOrAddBytes(
      this.stimuli,
      stimulus,
      this.stimuliBytes,
      true
    )
    const pIdx = this.getOrAddBytes(
      this.participants,
      participant,
      this.participantBytes
    )

    let aoiIds: number[] | null = null
    if (aoi && aoi.length > 0) {
      aoiIds = []
      const map = this.aoiMaps[sIdx]
      const list = this.aoisPerStimulus[sIdx]

      for (let i = 0; i < aoi.length; i++) {
        const nameBytes = aoi[i]
        const id = this.getOrAddBytes(map, nameBytes, list)
        aoiIds.push(id)
      }
      this.totalAoiHits += aoiIds.length
    }

    if (!this.buckets[sIdx]) this.buckets[sIdx] = []
    if (!this.buckets[sIdx][pIdx]) {
      this.buckets[sIdx][pIdx] = new SegmentBucket()
    }

    this.buckets[sIdx][pIdx].add(start, end, categoryId, aoiIds, spatial)
    this.totalSegments++
  }

  /**
   * Mark the (stimulus, participant) group PROVISIONAL and return a stable
   * handle. A gating format calls this for the EXACT byte keys it emits segments
   * under, so the handle addresses the same bucket those segments land in — no
   * re-matching at finalize. Provisional buckets are dropped by `buildFinalData`
   * unless `commitProvisionalGroup` confirms them (safe-by-default: an
   * unconfirmed group never reaches the dataset). Interns the keys via the same
   * path `addSegmentBytes` uses, so it works whether called before or after the
   * group's first segment. Idempotent: re-marking returns the existing handle.
   * COLD PATH — once per gated group, never per row.
   */
  beginProvisionalGroup(stimulus: Uint8Array, participant: Uint8Array): number {
    const sIdx = this.getOrAddBytes(
      this.stimuli,
      stimulus,
      this.stimuliBytes,
      true
    )
    const pIdx = this.getOrAddBytes(
      this.participants,
      participant,
      this.participantBytes
    )
    if (!this.buckets[sIdx]) this.buckets[sIdx] = []
    let bucket = this.buckets[sIdx][pIdx]
    if (!bucket) {
      bucket = new SegmentBucket()
      this.buckets[sIdx][pIdx] = bucket
    }
    if (bucket.state === BUCKET_PROVISIONAL) return bucket.handle
    // Never demote a committed group back to provisional.
    if (bucket.state === BUCKET_AUTO) {
      bucket.state = BUCKET_PROVISIONAL
      bucket.handle = this.provisional.length
      this.provisional.push(bucket)
    }
    return bucket.handle
  }

  /** Confirm a provisional group valid — it will be materialized. O(1). */
  commitProvisionalGroup(handle: number): void {
    const bucket = this.provisional[handle]
    if (bucket && bucket.state === BUCKET_PROVISIONAL) {
      bucket.state = BUCKET_COMMITTED
    }
  }

  /**
   * Reject a provisional group: zero its segments and return it to AUTO so a
   * later file writing the same (stimulus, participant) starts clean.
   * `totalSegments`/`totalAoiHits` are left as upper bounds — final buffers are
   * sized from them and trimmed to the written length, so over-allocation is
   * harmless. Any AOI a dropped segment registered is removed by the orphan-AOI
   * prune in `buildFinalData`.
   */
  dropProvisionalGroup(handle: number): void {
    const bucket = this.provisional[handle]
    if (bucket && bucket.state === BUCKET_PROVISIONAL) {
      bucket.count = 0
      bucket.state = BUCKET_AUTO
      bucket.handle = -1
    }
  }

  add(row: SegmentRow): void {
    const stimBytes = encodeString(row.stimulus, this.encoding)
    const participantBytes = encodeString(row.participant, this.encoding)
    const aoiBytes = row.aoi
      ? row.aoi.map(a => encodeString(a, this.encoding))
      : null
    const cat = this.internCategory(row.category)
    const start = Number(row.start)
    const end = Number(row.end)
    this.addSegmentBytes(start, end, cat, stimBytes, participantBytes, aoiBytes)
  }

  buildFinalData(): DataType {
    this.stimuliBytes = this.stimuli.getValues()
    this.participantBytes = this.participants.getValues()

    const maxParticipants = this.participantBytes.length
    const maxStimuli = this.stimuliBytes.length

    // Data integrity check: ensure we have at least one stimulus and one participant
    if (maxStimuli === 0 || maxParticipants === 0) {
      if (maxStimuli === 0 && this.emptyDatasetError !== null) {
        throw new Error(this.emptyDatasetError)
      }
      throw new Error(
        `Parsing unsuccessful: ${
          maxStimuli === 0 ? 'No stimuli found' : 'No participants found'
        }. Please check your data file.`
      )
    }

    // Allocate final contiguous buffers
    const finalSegBuffer = new Float32Array(this.totalSegments * SEGMENT_STRIDE)
    const aoiPool = new Uint16Array(this.totalAoiHits)
    const indexTable = new Uint32Array(maxStimuli * maxParticipants * 2)

    /* Spatial buffer allocation: check if any buckets have spatial data */
    let hasSpatialData = false
    for (let s = 0; s < maxStimuli; s++) {
      const pBuckets = this.buckets[s]
      if (!pBuckets) continue
      for (let p = 0; p < maxParticipants; p++) {
        const bucket = pBuckets[p]
        if (bucket && bucket.hasSpatialData) {
          hasSpatialData = true
          break
        }
      }
      if (hasSpatialData) break
    }

    // Allocate spatial buffer if needed (stride 2: x, y per segment)
    const spatialBuffer = hasSpatialData
      ? new Float32Array(this.totalSegments * 2)
      : undefined

    let segPtr = 0
    let poolPtr = 0
    let spatialPtr = 0

    // Half-open [start, end) range of `aoiPool` written for each stimulus, so
    // the unreferenced-AOI prune below can scan exactly that stimulus's hits.
    const aoiRangeStart = new Uint32Array(maxStimuli)
    const aoiRangeEnd = new Uint32Array(maxStimuli)

    // Iterate Stimuli -> Participants
    for (let s = 0; s < maxStimuli; s++) {
      aoiRangeStart[s] = poolPtr
      const pBuckets = this.buckets[s]
      if (!pBuckets) {
        aoiRangeEnd[s] = poolPtr
        continue
      }

      for (let p = 0; p < maxParticipants; p++) {
        const bucket = pBuckets[p]
        // Skip empty buckets and PROVISIONAL groups never committed — the
        // safe-by-default drop: an unconfirmed gated group is not materialized.
        if (!bucket || bucket.count === 0 || bucket.state === BUCKET_PROVISIONAL)
          continue

        const tableIdx = (s * maxParticipants + p) * 2
        indexTable[tableIdx] = segPtr

        // A. Sort Indices locally
        const indices = bucket.getSortedIndices()

        // B. Flatten & Deduplicate
        // Local variables for fast access in loop
        let lastStart = -1,
          lastEnd = -1,
          lastCat = -1
        let isFirst = true

        const bData = bucket.data
        const bAoiCounts = bucket.aoiCounts
        const bAoiOffsets = bucket.aoiOffsets
        const bAoiBuf = bucket.aoiBuffer
        const bSpatial = bucket.spatialData

        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i]
          const ptr = idx * 3

          const start = bData[ptr]
          const end = bData[ptr + 1]
          const cat = bData[ptr + 2]
          const aoiCount = bAoiCounts[idx]

          // Deduplication Check
          if (
            !isFirst &&
            start === lastStart &&
            end === lastEnd &&
            cat === lastCat
          ) {
            // MERGE: Add AOIs to previous segment
            if (aoiCount > 0) {
              const prevSegIndex = (segPtr - 1) * SEGMENT_STRIDE

              // Copy AOIs to pool
              const offset = bAoiOffsets[idx]
              for (let k = 0; k < aoiCount; k++) {
                aoiPool[poolPtr++] = bAoiBuf[offset + k]
              }
              // Increment count in previous segment
              finalSegBuffer[prevSegIndex + SegmentField.AOI_COUNT] += aoiCount
            }
          } else {
            // NEW SEGMENT
            const outBase = segPtr * SEGMENT_STRIDE
            finalSegBuffer[outBase + SegmentField.START_TIME] = start
            finalSegBuffer[outBase + SegmentField.END_TIME] = end
            finalSegBuffer[outBase + SegmentField.CATEGORY_ID] = cat
            finalSegBuffer[outBase + SegmentField.AOI_POINTER] = poolPtr
            finalSegBuffer[outBase + SegmentField.AOI_COUNT] = aoiCount // Initial count

            // Copy AOIs
            if (aoiCount > 0) {
              const offset = bAoiOffsets[idx]
              for (let k = 0; k < aoiCount; k++) {
                aoiPool[poolPtr++] = bAoiBuf[offset + k]
              }
            }

            // Copy Spatial Data (stride 2)
            if (spatialBuffer && bSpatial) {
              spatialBuffer[spatialPtr * 2] = bSpatial[idx * 2]
              spatialBuffer[spatialPtr * 2 + 1] = bSpatial[idx * 2 + 1]
            } else if (spatialBuffer) {
              // Fill with NaN if spatial buffer allocated but no data for this segment
              spatialBuffer[spatialPtr * 2] = Number.NaN
              spatialBuffer[spatialPtr * 2 + 1] = Number.NaN
            }

            // Update State
            lastStart = start
            lastEnd = end
            lastCat = cat
            isFirst = false
            segPtr++
            spatialPtr++
          }
        }

        indexTable[tableIdx + 1] = segPtr
      }

      aoiRangeEnd[s] = poolPtr
    }

    // Prune AOIs no surviving segment references. A name registers in a
    // stimulus's AOI list the moment any segment hits it (in addSegmentBytes,
    // before validity is known), but a never-committed provisional group is
    // skipped above, leaving names that no remaining segment points at. Keep
    // only AOIs actually referenced in each stimulus's pool range and remap the
    // pool ids to the compacted (original-order) list.
    const prunedAoisPerStimulus: Uint8Array[][] = []
    for (let s = 0; s < maxStimuli; s++) {
      const fullList = this.aoisPerStimulus[s] ?? []
      const used = new Uint8Array(fullList.length)
      for (let i = aoiRangeStart[s]; i < aoiRangeEnd[s]; i++) used[aoiPool[i]] = 1

      const remap = new Int32Array(fullList.length)
      const pruned: Uint8Array[] = []
      for (let id = 0; id < fullList.length; id++) {
        if (used[id]) {
          remap[id] = pruned.length
          pruned.push(fullList[id])
        }
      }
      if (pruned.length !== fullList.length) {
        for (let i = aoiRangeStart[s]; i < aoiRangeEnd[s]; i++) {
          aoiPool[i] = remap[aoiPool[i]]
        }
      }
      prunedAoisPerStimulus.push(pruned)
    }

    // Natural sort comparator that handles numeric sequences correctly (2, 3, ..., 10 instead of 10, 2, 3, ...)
    const naturalSort = (aStr: string, bStr: string): number => {
      const aChunks = aStr.split(/(\d+)/g)
      const bChunks = bStr.split(/(\d+)/g)

      for (let i = 0; i < Math.max(aChunks.length, bChunks.length); i++) {
        const aChunk = aChunks[i] ?? ''
        const bChunk = bChunks[i] ?? ''

        if (aChunk === bChunk) continue

        const aNum = Number(aChunk)
        const bNum = Number(bChunk)

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum
        }

        return aChunk.localeCompare(bChunk)
      }

      return 0
    }

    // Create naturally sorted order vectors
    const stimuliOrderVector: number[] = Array.from(
      { length: this.stimuliBytes.length },
      (_, i) => i
    )
    stimuliOrderVector.sort((a, b) =>
      naturalSort(
        decodeBytes(this.stimuliBytes[a], this.decoder),
        decodeBytes(this.stimuliBytes[b], this.decoder)
      )
    )

    const participantsOrderVector: number[] = Array.from(
      { length: this.participantBytes.length },
      (_, i) => i
    )
    participantsOrderVector.sort((a, b) =>
      naturalSort(
        decodeBytes(this.participantBytes[a], this.decoder),
        decodeBytes(this.participantBytes[b], this.decoder)
      )
    )

    const aoisOrderVectors = prunedAoisPerStimulus.map(list => {
      const indices: number[] = Array.from({ length: list.length }, (_, i) => i)
      indices.sort((a, b) =>
        naturalSort(
          decodeBytes(list[a], this.decoder),
          decodeBytes(list[b], this.decoder)
        )
      )
      return indices
    })

    return {
      isOrdinalOnly: false,
      capabilities: {
        segmented: segPtr > 0,
        spatial: hasSpatialData,
        event: false,
      },
      stimuli: {
        data: this.stimuliBytes.map(v => [decodeBytes(v, this.decoder)]),
        orderVector: stimuliOrderVector,
      },
      participants: {
        data: this.participantBytes.map(v => [decodeBytes(v, this.decoder)]),
        orderVector: participantsOrderVector,
      },
      participantsGroups: [],
      metricInstances: createDefaultMetricInstances(),
      categories: { data: this.buildCategoriesData(), orderVector: [] },
      aois: {
        data: prunedAoisPerStimulus.map(list =>
          list.map(a => [decodeBytes(a, this.decoder)])
        ),
        orderVector: aoisOrderVectors,
        hiddenAois: [],
      },
      segments: {
        segmentBuffer: finalSegBuffer.subarray(0, segPtr * SEGMENT_STRIDE),
        indexTable,
        aoiPool: aoiPool.subarray(0, poolPtr),
        hasSpatialData,
        spatialBuffer: spatialBuffer
          ? spatialBuffer.subarray(0, spatialPtr * 2)
          : undefined,
        maxParticipants,
        stimuliCount: maxStimuli,
      },
      noAoiTreatment: { ...DEFAULT_NO_AOI_TREATMENT },
      eventData: {
        data: Array.from({ length: maxStimuli }, () => []),
        orderVector: [],
        hiddenChannels: [],
        events: Array.from({ length: maxStimuli }, () => [] as number[][][]),
      },
    }
  }

  /**
   * Build `categories.data` from the interned category names — only the types
   * actually emitted, in id order, with Fixation guaranteed at id 0. Replaces
   * the former fixed `[['Fixation'],['Saccade']]` seed.
   */
  private buildCategoriesData(): string[][] {
    this.ensureCategorySeed()
    return this.categoryNames.map(name => [name])
  }

  private getOrAddBytes(
    map: ByteDictionary,
    name: Uint8Array,
    list: Uint8Array[],
    isStim = false
  ): number {
    const idx = map.getId(name)
    if (idx === list.length) {
      list.push(name)
      if (isStim) {
        this.aoisPerStimulus.push([])
        this.aoiMaps.push(new ByteDictionary())
      }
    }
    return idx
  }
}
