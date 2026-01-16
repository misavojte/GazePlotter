import {
  SEGMENT_STRIDE,
  SegmentField,
  MAX_AOI_PER_STIMULUS,
} from '$lib/gaze-data/shared/types/binaryDataTypes'
import type { DataType } from '$lib/gaze-data/shared/types'
import { DEFAULT_NO_AOI_TREATMENT } from '$lib/gaze-data/shared/types'
import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput'

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

  count = 0
  aoiTotalCount = 0 // Pointer for aoiBuffer

  constructor(initialCapacity = 2000) {
    this.data = new Float64Array(initialCapacity * 3)
    this.aoiCounts = new Uint8Array(initialCapacity)
    this.aoiOffsets = new Uint32Array(initialCapacity)
    // Assume average of 1 AOI per row for initial sizing
    this.aoiBuffer = new Uint16Array(initialCapacity)
  }

  add(start: number, end: number, cat: number, aois: number[] | null) {
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

export class BinaryEyeWriter {
  // Metadata
  private stimuli = new Map<string, number>()
  private participants = new Map<string, number>()
  private stimuliNames: string[] = []
  private participantNames: string[] = []

  // AOI Mapping
  private aoiMaps: Map<string, number>[] = []
  private aoisPerStimulus: string[][] = []

  // Data Storage
  private buckets: SegmentBucket[][] = []
  private totalSegments = 0
  private totalAoiHits = 0

  add(row: SingleDeserializerOutput): void {
    // 1. Resolve Indices (Cached Lookups)
    const sIdx = this.getOrAdd(
      this.stimuli,
      row.stimulus,
      this.stimuliNames,
      true
    )
    const pIdx = this.getOrAdd(
      this.participants,
      row.participant,
      this.participantNames
    )

    // 2. Resolve AOI IDs
    let aoiIds: number[] | null = null
    const rawAois = row.aoi

    if (rawAois && rawAois.length > 0) {
      // Optimization: allocating this small array is unavoidable to pass to bucket
      // unless we refactor bucket to accept iterator/raw strings.
      // But keeping it numeric here is cleaner.
      aoiIds = []
      const map = this.aoiMaps[sIdx]
      const list = this.aoisPerStimulus[sIdx]

      for (let i = 0; i < rawAois.length; i++) {
        const name = rawAois[i]
        let id = map.get(name)
        if (id === undefined) {
          id = list.length
          map.set(name, id)
          list.push(name)
        }
        aoiIds.push(id)
      }
      this.totalAoiHits += aoiIds.length
    }

    // 3. Bucket Insertion
    const start = Number(row.start)
    const end = Number(row.end)
    const cat = row.category.charCodeAt(0) === 70 ? 0 : 1 // 'F'ixation check is fast

    if (!this.buckets[sIdx]) this.buckets[sIdx] = []
    if (!this.buckets[sIdx][pIdx]) {
      this.buckets[sIdx][pIdx] = new SegmentBucket()
    }

    this.buckets[sIdx][pIdx].add(start, end, cat, aoiIds)
    this.totalSegments++
  }

  buildFinalData(): DataType {
    const maxParticipants = this.participantNames.length
    const maxStimuli = this.stimuliNames.length

    // Allocate final contiguous buffers
    const finalSegBuffer = new Float32Array(this.totalSegments * SEGMENT_STRIDE)
    const aoiPool = new Uint16Array(this.totalAoiHits)
    const indexTable = new Uint32Array(maxStimuli * maxParticipants * 2)

    let segPtr = 0
    let poolPtr = 0

    // Iterate Stimuli -> Participants
    for (let s = 0; s < maxStimuli; s++) {
      const pBuckets = this.buckets[s]
      if (!pBuckets) continue

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

            // Update State
            lastStart = start
            lastEnd = end
            lastCat = cat
            isFirst = false
            segPtr++
          }
        }

        indexTable[tableIdx + 1] = segPtr
      }
    }

    return {
      isOrdinalOnly: false,
      stimuli: { data: this.stimuliNames.map(v => [v]), orderVector: [] },
      participants: {
        data: this.participantNames.map(v => [v]),
        orderVector: [],
      },
      participantsGroups: [],
      categories: { data: [['Fixation'], ['Saccade']], orderVector: [] },
      aois: {
        data: this.aoisPerStimulus.map(v => v.map(a => [a])),
        orderVector: [],
        dynamicVisibility: {},
        hiddenAois: [],
      },
      segments: {
        segmentBuffer: finalSegBuffer.subarray(0, segPtr * SEGMENT_STRIDE),
        indexTable,
        aoiPool: aoiPool.subarray(0, poolPtr),
        groupMap: new Uint16Array(maxStimuli * MAX_AOI_PER_STIMULUS).fill(
          0xffff
        ),
        maxParticipants,
        stimuliCount: maxStimuli,
      },
      noAoiTreatment: { ...DEFAULT_NO_AOI_TREATMENT },
    }
  }

  private getOrAdd(
    map: Map<string, number>,
    name: string,
    list: string[],
    isStim = false
  ): number {
    let idx = map.get(name)
    if (idx === undefined) {
      idx = list.length
      map.set(name, idx)
      list.push(name)
      if (isStim) {
        this.aoisPerStimulus.push([])
        this.aoiMaps.push(new Map())
      }
    }
    return idx
  }
}
