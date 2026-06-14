import { SEGMENT_STRIDE, SegmentField, FIXATION_CATEGORY_ID } from '$lib/data/binary'
import type { DataType } from '$lib/data/types'
import { DEFAULT_NO_AOI_TREATMENT } from '$lib/data/types'
import { createDefaultMetricInstances } from '$lib/metrics/instances'
import type { SegmentRow } from '../types'
import type { TextEncoding } from '$lib/data/ingest/utils/byteUtils'
import {
  bytesEqual,
  decodeBytes,
  encodeString,
} from '$lib/data/ingest/utils/byteUtils'

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

class ByteDictionary {
  private items: Uint8Array[] = []
  private hashMap = new Map<number, number[]>()

  getId(value: Uint8Array): number {
    const hash = this.hashBytes(value)
    const existing = this.hashMap.get(hash)
    if (existing) {
      for (let i = 0; i < existing.length; i++) {
        const id = existing[i]
        if (bytesEqual(value, this.items[id])) return id
      }
    }
    const id = this.items.length
    this.items.push(value)
    if (existing) existing.push(id)
    else this.hashMap.set(hash, [id])
    return id
  }

  getValues(): Uint8Array[] {
    return this.items
  }

  /** Lookup-only: id of an existing value, or -1. Never inserts. */
  findId(value: Uint8Array): number {
    const existing = this.hashMap.get(this.hashBytes(value))
    if (existing) {
      for (let i = 0; i < existing.length; i++) {
        if (bytesEqual(value, this.items[existing[i]])) return existing[i]
      }
    }
    return -1
  }

  private hashBytes(bytes: Uint8Array): number {
    let hash = 2166136261
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i]
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
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

  // AOI Mapping
  private aoiMaps: ByteDictionary[] = []
  private aoisPerStimulus: Uint8Array[][] = []

  // Data Storage
  private buckets: SegmentBucket[][] = []
  private totalSegments = 0
  private totalAoiHits = 0

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
   * Retract every segment for one (stimulus, participant) group, addressed by
   * the same byte keys `addSegmentBytes` used. `buildFinalData` skips
   * zero-count buckets, so the group drops out of the dataset entirely (the
   * stimulus and participant themselves remain for their other groups).
   * `totalSegments`/`totalAoiHits` are left as upper bounds — the final
   * buffers are sized from them and trimmed to the actually-written length, so
   * over-allocation is harmless. No-op if the group never produced segments.
   */
  excludeGroup(stimulus: Uint8Array, participant: Uint8Array): void {
    const sIdx = this.stimuli.findId(stimulus)
    if (sIdx === -1) return
    const pIdx = this.participants.findId(participant)
    if (pIdx === -1) return
    const bucket = this.buckets[sIdx]?.[pIdx]
    if (bucket) bucket.count = 0
  }

  add(row: SegmentRow): void {
    const stimBytes = encodeString(row.stimulus, this.encoding)
    const participantBytes = encodeString(row.participant, this.encoding)
    const aoiBytes = row.aoi
      ? row.aoi.map(a => encodeString(a, this.encoding))
      : null
    const cat = row.category.charCodeAt(0) === 70 ? FIXATION_CATEGORY_ID : 1
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
        if (!bucket || bucket.count === 0) continue

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
    // stimulus's AOI list the moment any segment hits it, but segments can be
    // dropped afterwards (excludeGroup), leaving names that no remaining
    // segment points at. Keep only AOIs actually referenced in each stimulus's
    // pool range and remap the pool ids to the compacted (original-order) list.
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
      categories: { data: [['Fixation'], ['Saccade']], orderVector: [] },
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
