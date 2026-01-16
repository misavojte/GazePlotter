import {
  SEGMENT_STRIDE,
  SegmentField,
  MAX_AOI_PER_STIMULUS,
} from '$lib/gaze-data/shared/types/binaryDataTypes'
import type {
  DataType,
  BinarySegmentBuffers,
} from '$lib/gaze-data/shared/types'
import { DEFAULT_NO_AOI_TREATMENT } from '$lib/gaze-data/shared/types'
import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput'

export class BinaryEyeWriter {
  // Metadata Maps (O(1) Lookups)
  private stimuli = new Map<string, number>()
  private participants = new Map<string, number>()
  private aoiMaps: Map<string, number>[] = []

  // Data for final DataType structure
  private stimuliNames: string[] = []
  private participantNames: string[] = []
  private aoisPerStimulus: string[][] = []

  // Intermediate Raw Storage (Typed Arrays)
  // Pre-allocate large chunks to avoid frequent re-allocation
  private rawSegments = new Float64Array(100000 * 5) // [stimIdx, partIdx, start, end, category]
  private rawAois: (number[] | null)[] = []
  private count = 0

  add(row: SingleDeserializerOutput): void {
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

    // Ensure capacity
    if ((this.count + 1) * 5 > this.rawSegments.length) {
      const newBuf = new Float64Array(this.rawSegments.length * 2)
      newBuf.set(this.rawSegments)
      this.rawSegments = newBuf
    }

    const base = this.count * 5
    this.rawSegments[base + 0] = sIdx
    this.rawSegments[base + 1] = pIdx
    this.rawSegments[base + 2] = Number(row.start)
    this.rawSegments[base + 3] = Number(row.end)
    this.rawSegments[base + 4] =
      row.category.toLowerCase() === 'fixation' ? 0 : 1

    // Direct AOI ID mapping
    if (row.aoi && row.aoi.length > 0) {
      this.rawAois[this.count] = row.aoi.map(name =>
        this.getOrAddAoi(name, sIdx)
      )
    } else {
      this.rawAois[this.count] = null
    }

    this.count++
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

  private getOrAddAoi(name: string, sIdx: number): number {
    const map = this.aoiMaps[sIdx]
    let idx = map.get(name)
    if (idx === undefined) {
      idx = this.aoisPerStimulus[sIdx].length
      map.set(name, idx)
      this.aoisPerStimulus[sIdx].push(name)
    }
    return idx
  }

  buildFinalData(): DataType {
    const n = this.count
    const indices = new Uint32Array(n)
    for (let i = 0; i < n; i++) indices[i] = i

    // 1. Sort Proxy Indices: O(N log N)
    // Sort by Stimulus -> Participant -> StartTime
    indices.sort((a, b) => {
      const baseA = a * 5
      const baseB = b * 5
      return (
        this.rawSegments[baseA + 0] - this.rawSegments[baseB + 0] || // Stim
        this.rawSegments[baseA + 1] - this.rawSegments[baseB + 1] || // Part
        this.rawSegments[baseA + 2] - this.rawSegments[baseB + 2]
      ) // Start
    })

    // 2. Linear Pass: Merge & Build Buffers (O(N))
    const finalSegBuffer = new Float32Array(n * SEGMENT_STRIDE)
    const aoiPool = new Uint16Array(n * 5) // Estimated pool size
    const maxParticipants = this.participantNames.length
    const indexTable = new Uint32Array(
      this.stimuliNames.length * maxParticipants * 2
    )

    let segPtr = 0
    let poolPtr = 0
    let lastS = -1,
      lastP = -1

    for (let i = 0; i < n; i++) {
      const idx = indices[i]
      const base = idx * 5
      const s = this.rawSegments[base + 0]
      const p = this.rawSegments[base + 1]
      const start = this.rawSegments[base + 2]
      const end = this.rawSegments[base + 3]
      const cat = this.rawSegments[base + 4]

      // Update Index Table for new Participant/Stimulus ranges
      if (s !== lastS || p !== lastP) {
        const tableIdx = (s * maxParticipants + p) * 2
        indexTable[tableIdx] = segPtr
        // Close previous range
        if (lastS !== -1) {
          const prevTableIdx = (lastS * maxParticipants + lastP) * 2
          indexTable[prevTableIdx + 1] = segPtr
        }
      }

      // Merge Logic (Check if current matches previous in final buffer)
      const prevBase = (segPtr - 1) * SEGMENT_STRIDE
      if (
        segPtr > 0 &&
        s === lastS &&
        p === lastP &&
        finalSegBuffer[prevBase + SegmentField.START_TIME] === start &&
        finalSegBuffer[prevBase + SegmentField.END_TIME] === end &&
        finalSegBuffer[prevBase + SegmentField.CATEGORY_ID] === cat
      ) {
        // It's a duplicate: just append new AOIs to the previous segment's pool
        const aois = this.rawAois[idx]
        if (aois) {
          for (const aoiId of aois) aoiPool[poolPtr++] = aoiId
          finalSegBuffer[prevBase + SegmentField.AOI_COUNT] += aois.length
        }
      } else {
        // New unique segment
        const outBase = segPtr * SEGMENT_STRIDE
        finalSegBuffer[outBase + SegmentField.START_TIME] = start
        finalSegBuffer[outBase + SegmentField.END_TIME] = end
        finalSegBuffer[outBase + SegmentField.CATEGORY_ID] = cat
        finalSegBuffer[outBase + SegmentField.AOI_POINTER] = poolPtr

        const aois = this.rawAois[idx]
        if (aois) {
          for (const aoiId of aois) aoiPool[poolPtr++] = aoiId
          finalSegBuffer[outBase + SegmentField.AOI_COUNT] = aois.length
        }
        segPtr++
      }
      lastS = s
      lastP = p
    }

    // Finalize last index table entry
    if (lastS !== -1) {
      indexTable[(lastS * maxParticipants + lastP) * 2 + 1] = segPtr
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
        groupMap: new Uint16Array(
          this.stimuliNames.length * MAX_AOI_PER_STIMULUS
        ).fill(0xffff),
        maxParticipants,
        stimuliCount: this.stimuliNames.length,
      },
      noAoiTreatment: { ...DEFAULT_NO_AOI_TREATMENT },
    }
  }
}
