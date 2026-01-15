import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput.js'
import type {
  DataType,
  BinarySegmentBuffers,
} from '$lib/gaze-data/shared/types'
import {
  SEGMENT_STRIDE,
  SegmentField,
  MAX_AOI_PER_STIMULUS,
} from '$lib/gaze-data/shared/types/binaryDataTypes'
import { jsonSegmentsToBinary } from '$lib/gaze-data/shared/types/binaryConverters'

/**
 * Binary-based EyeWriter that constructs segment data in typed arrays.
 * Uses temporary nested structure during construction, then builds binary buffers at the end.
 */
export class BinaryEyeWriter {
  // Base data without segments (will be combined with binary buffers later)
  private baseData: Omit<DataType, 'segments'> = {
    isOrdinalOnly: false,
    stimuli: { data: [], orderVector: [] },
    participants: { data: [], orderVector: [] },
    participantsGroups: [],
    categories: { data: [['Fixation'], ['Saccade']], orderVector: [] },
    aois: { data: [], orderVector: [], dynamicVisibility: {} },
  }

  lastData: SingleDeserializerOutput | null = null

  // Temporary nested structure during construction (will be converted to binary)
  private tempSegments: number[][][][] = []

  /**
   * Getter for accessing data (for compatibility with EyePipeline).
   * Note: segments will be empty array until buildFinalData() is called.
   */
  get data(): DataType {
    return {
      ...this.baseData,
      segments: this.tempSegments,
    }
  }

  add(row: SingleDeserializerOutput): void {
    this.lastData = row

    const stimulusIndex = this.processStimulus(row.stimulus)
    const participantIndex = this.processParticipant(
      row.participant,
      stimulusIndex
    )
    const aoiIDs = this.processAOIs(row.aoi, stimulusIndex)
    const categoryID = this.processCategory(row.category)

    // Build segment array: [start, end, category, ...aoiIds]
    let segment = [Number(row.start), Number(row.end), categoryID]
    if (aoiIDs !== null) {
      segment = segment.concat(aoiIDs)
    }

    // Store in temporary nested structure
    this.tempSegments[stimulusIndex][participantIndex] ??= []
    this.tempSegments[stimulusIndex][participantIndex].push(segment)
  }

  processStimulus(sName: string): number {
    const sData = this.baseData.stimuli.data
    let sIndex = sData.findIndex(el => el[0] === sName)

    if (sIndex === -1) {
      sIndex = sData.length
      sData.push([sName])
      this.baseData.aois.data.push([])
      this.tempSegments.push([])
    }

    return sIndex
  }

  processParticipant(pName: string, sIndex: number): number {
    const pData = this.baseData.participants.data
    let pIndex = pData.findIndex(el => el[0] === pName)

    if (pIndex === -1) {
      pIndex = pData.length
      pData.push([pName])
      this.tempSegments[sIndex].push([])
    }

    return pIndex
  }

  processCategory(cName: string): number {
    const cData = this.baseData.categories.data
    let cIndex = cData.findIndex(el => el[0] === cName)
    if (cIndex === -1) {
      cIndex = cData.length
      cData.push([cName])
    }
    return cIndex
  }

  processAOIs(aNames: string[] | null, sIndex: number): null | number[] {
    if (aNames === null) return null
    const aois: number[] = []
    for (let i = 0; i < aNames.length; i++) {
      const aoi = this.processAOI(aNames[i], sIndex)
      if (aoi !== null) aois.push(aoi)
    }
    if (aois.length === 0) return null
    return aois
  }

  processAOI(aName: string | null, sIndex: number): null | number {
    if (aName === null) return null

    const aData = this.baseData.aois.data[sIndex]
    let aIndex = aData.findIndex(el => el[0] === aName)

    if (aIndex === -1) {
      aIndex = aData.length
      aData.push([aName + ''])
    }

    return aIndex
  }

  /**
   * Refine and build the final binary buffers from accumulated segment data.
   * This should be called after all segments have been added.
   *
   * Performs the following refinements:
   * - Orders segments by start time
   * - Merges duplicated fixation segments
   * - Orders AOIs alphabetically
   * - Orders participants alphabetically
   *
   * @param groupMap - Optional grouping map for AOI name-based grouping
   * @returns Complete DataType with binary segment buffers
   */
  buildFinalData(groupMap?: Uint16Array): DataType {
    const binaryBuffers = this.buildBinaryBuffers(groupMap)
    return {
      ...this.baseData,
      segments: binaryBuffers,
    }
  }

  /**
   * Internal method to build binary buffers after refinement.
   * Use buildFinalData() instead for getting the complete DataType.
   *
   * @param groupMap - Optional grouping map for AOI name-based grouping
   * @returns Binary segment buffers ready for use
   */
  private buildBinaryBuffers(groupMap?: Uint16Array): BinarySegmentBuffers {
    // Refine the data before converting to binary
    this.sortSegments()
    this.mergeDuplicatedSegments()
    this.orderAoisAlphabetically()
    this.orderParticipantsAlphabetically()

    // Convert temp nested structure to binary
    return jsonSegmentsToBinary(this.tempSegments, groupMap)
  }

  /**
   * Sort segments by start time for each participant.
   */
  private sortSegments(): void {
    const noOfStimuli = this.tempSegments.length
    const noOfParticipants = this.baseData.participants.data.length

    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      for (
        let participantId = 0;
        participantId < noOfParticipants;
        participantId++
      ) {
        const segmentPart = this.tempSegments[stimulusId]?.[participantId]
        if (segmentPart === undefined) continue
        // Sort by start time (index 0)
        segmentPart.sort((a, b) => a[0] - b[0])
      }
    }
  }

  /**
   * Merge duplicated fixation segments with identical start/end times.
   * Combines AOI IDs into a single segment.
   */
  private mergeDuplicatedSegments(): void {
    const noOfStimuli = this.tempSegments.length
    const noOfParticipants = this.baseData.participants.data.length
    const fixationCategoryId = 0 // 0 = Fixation

    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      for (
        let participantId = 0;
        participantId < noOfParticipants;
        participantId++
      ) {
        const segmentPart = this.tempSegments[stimulusId]?.[participantId]
        if (segmentPart === undefined) continue

        let prevStart: number | null = null
        let prevEnd: number | null = null
        let segIdToJoin: number | null = null

        for (let segmentId = 0; segmentId < segmentPart.length; segmentId++) {
          const currSegment = segmentPart[segmentId]

          // Check if this is a duplicate fixation segment
          if (
            currSegment[0] === prevStart &&
            currSegment[1] === prevEnd &&
            currSegment[2] === fixationCategoryId &&
            segIdToJoin !== null
          ) {
            // Add AOI ID to the previous segment if not already present
            const currentAoi = currSegment[3]
            const segmentToJoin = segmentPart[segIdToJoin]
            const aoiAlreadyIn = segmentToJoin.slice(3).includes(currentAoi)

            if (!aoiAlreadyIn && currentAoi !== undefined) {
              segmentToJoin.push(currentAoi)
            }

            // Remove duplicate segment
            segmentPart.splice(segmentId, 1)
            segmentId--
          } else {
            segIdToJoin = segmentId
          }

          prevStart = currSegment[0]
          prevEnd = currSegment[1]
        }
      }
    }
  }

  /**
   * Order AOIs alphabetically and create order vectors.
   */
  private orderAoisAlphabetically(): void {
    const aois = this.baseData.aois
    for (let i = 0; i < aois.data.length; i++) {
      const currentAoiArray = aois.data[i]
      const indexedArr = currentAoiArray.map((value, index) => ({
        index,
        name: value[0],
      }))
      indexedArr.sort((a, b) => a.name.localeCompare(b.name))
      aois.orderVector[i] = indexedArr.map(value => value.index)
    }
  }

  /**
   * Order participants alphabetically and create order vector.
   */
  private orderParticipantsAlphabetically(): void {
    const participants = this.baseData.participants
    const indexedArr = participants.data.map((value, index) => ({
      index,
      name: value[0],
    }))
    indexedArr.sort((a, b) => a.name.localeCompare(b.name))
    participants.orderVector = indexedArr.map(value => value.index)
  }
}
