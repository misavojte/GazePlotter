import {
  getSegments,
  getData,
} from '$lib/gaze-data/front-process/stores/dataStore'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import { arraysHaveSameElements } from '$lib/shared/utils/mathUtils'

/**
 * Collects transition metrics for a set of participants.
 * This is an optimized single-pass collector that avoids redundant AOI lookups.
 */
export function collectTransitionMetrics(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[],
  mode: 'fixation' | 'visit' = 'fixation'
) {
  const aoiCount = aois.length
  const matrixSize = aoiCount + 1
  const outsideAoiIndex = aoiCount

  // Pre-calculate AOI lookup map for O(1) index access
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) {
    aoiLookup.set(aois[i].id, i)
  }

  // Aggregate structures
  const sumMatrix = Array.from(
    { length: matrixSize },
    () => new Float64Array(matrixSize)
  )
  const dwellTimeMatrix = Array.from(
    { length: matrixSize },
    () => new Float64Array(matrixSize)
  )
  const dwellCountMatrix = Array.from(
    { length: matrixSize },
    () => new Int32Array(matrixSize)
  )
  let totalTransitions = 0

  for (const participantId of participantIds) {
    const segments = getSegments(stimulusId, participantId, [0]) // Fixations only
    if (segments.length <= 1) continue

    if (mode === 'fixation') {
      let lastFromIndices: number[] = []
      let lastFixationDuration = 0
      let hasLast = false

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const currentIndices: number[] = []

        if (seg.aoi.length === 0) {
          currentIndices.push(outsideAoiIndex)
        } else {
          for (let j = 0; j < seg.aoi.length; j++) {
            const idx = aoiLookup.get(seg.aoi[j].id)
            if (idx !== undefined) currentIndices.push(idx)
          }
        }

        if (hasLast) {
          for (const fromIdx of lastFromIndices) {
            for (const toIdx of currentIndices) {
              sumMatrix[fromIdx][toIdx]++
              dwellTimeMatrix[fromIdx][toIdx] += lastFixationDuration
              dwellCountMatrix[fromIdx][toIdx]++
              totalTransitions++
            }
          }
        }

        lastFromIndices = currentIndices
        lastFixationDuration = seg.end - seg.start
        hasLast = true
      }
    } else {
      // Visit mode: consecutive fixations on same AOIs are merged
      let currentAoiIndices: number[] = []
      let currentVisitDuration = 0
      let isTracking = false

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const aoiIndices: number[] = []

        if (seg.aoi.length === 0) {
          aoiIndices.push(outsideAoiIndex)
        } else {
          for (let j = 0; j < seg.aoi.length; j++) {
            const idx = aoiLookup.get(seg.aoi[j].id)
            if (idx !== undefined) aoiIndices.push(idx)
          }
        }

        if (!isTracking) {
          currentAoiIndices = aoiIndices
          currentVisitDuration = seg.end - seg.start
          isTracking = true
          continue
        }

        if (!arraysHaveSameElements(currentAoiIndices, aoiIndices)) {
          // Transition occurred
          for (const fromIdx of currentAoiIndices) {
            for (const toIdx of aoiIndices) {
              sumMatrix[fromIdx][toIdx]++
              dwellTimeMatrix[fromIdx][toIdx] += currentVisitDuration
              dwellCountMatrix[fromIdx][toIdx]++
              totalTransitions++
            }
          }
          currentAoiIndices = aoiIndices
          currentVisitDuration = seg.end - seg.start
        } else {
          // Still in the same visit
          currentVisitDuration += seg.end - seg.start
        }
      }
    }
  }

  return {
    sumMatrix,
    dwellTimeMatrix,
    dwellCountMatrix,
    totalTransitions,
  }
}
