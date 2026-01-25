import { getSegments } from '$lib/gaze-data/front-process'
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
  const size = aoiCount + 1
  const outsideAoiIndex = aoiCount

  // Pre-calculate AOI lookup map for O(1) index access
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) {
    aoiLookup.set(aois[i].id, i)
  }

  // Aggregate structures (flat row-major)
  const totalCells = size * size
  const sumMatrix = new Float64Array(totalCells)
  const dwellTimeMatrix = new Float64Array(totalCells)
  const dwellCountMatrix = new Int32Array(totalCells)
  let totalTransitions = 0

  for (const participantId of participantIds) {
    const segments = getSegments(stimulusId, participantId, [0])
    if (segments.length <= 1) continue

    let prevIndices: number[] = []
    let prevDuration = 0

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const currAois = seg.aoi

      // Resolve current indices
      let currIndices: number[]
      if (currAois.length === 0) {
        currIndices = [outsideAoiIndex]
      } else {
        currIndices = []
        for (let j = 0; j < currAois.length; j++) {
          const idx = aoiLookup.get(currAois[j].id)
          if (idx !== undefined) currIndices.push(idx)
        }
        // Fallback if AOIs exist but none match known list (rare edge case)
        if (currIndices.length === 0) currIndices.push(outsideAoiIndex)
      }

      if (i > 0) {
        // Check transition condition
        const isTransition =
          mode === 'fixation' ||
          !arraysHaveSameElements(prevIndices, currIndices)

        if (isTransition) {
          // Record transitions from all 'prev' to all 'curr'
          const pLen = prevIndices.length
          const cLen = currIndices.length
          for (let p = 0; p < pLen; p++) {
            const from = prevIndices[p]
            const rowOffset = from * size
            for (let c = 0; c < cLen; c++) {
              const to = currIndices[c]
              const cellIdx = rowOffset + to
              sumMatrix[cellIdx]++
              dwellTimeMatrix[cellIdx] += prevDuration
              dwellCountMatrix[cellIdx]++
              totalTransitions++
            }
          }
        } else if (mode === 'visit') {
          // Same visit, just accumulate duration
          prevDuration += seg.end - seg.start
          continue
        }
      }

      prevIndices = currIndices
      prevDuration = seg.end - seg.start
    }
  }

  return {
    sumMatrix,
    dwellTimeMatrix,
    dwellCountMatrix,
    totalTransitions,
  }
}
