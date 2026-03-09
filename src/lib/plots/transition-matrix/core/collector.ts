import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { arraysHaveSameElements } from '$lib/shared/utils/mathUtils'

/**
 * Collects transition metrics for a set of participants.
 * This is an optimized single-pass collector that avoids redundant AOI lookups.
 */
export function collectTransitionMetrics(
  engine: DataEngine,
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[],
  mode: 'fixation' | 'visit' = 'fixation'
) {
  const reader = engine.getReader()
  const meta = engine.metadata
  if (!reader || !meta) throw new Error('Data engine metadata not available')

  const aoiCount = aois.length
  const size = aoiCount + 1
  const outsideAoiIndex = aoiCount
  const hiddenAois = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set(hiddenAois) : null

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
    let prevIndices: number[] = []
    let prevDuration = 0
    let fixationIndex = 0
    const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)

    for (let segmentIndex = startIndex; segmentIndex < endIndex; segmentIndex++) {
      if (reader.getSegmentCategory(segmentIndex) !== 0) continue

      // Resolve current indices
      let currIndices: number[]
      const rawAois = reader.getRawAois(segmentIndex)
      if (rawAois.length === 0) {
        currIndices = [outsideAoiIndex]
      } else {
        const currentIndexSet = new Set<number>()
        for (let rawIndex = 0; rawIndex < rawAois.length; rawIndex++) {
          const rawAoiId = rawAois[rawIndex]
          if (hiddenAoisSet?.has(rawAoiId)) continue
          const idx = aoiLookup.get(engine.getAoiMapping(stimulusId, rawAoiId))
          if (idx !== undefined) currentIndexSet.add(idx)
        }
        currIndices = Array.from(currentIndexSet)
        if (currIndices.length === 0) currIndices.push(outsideAoiIndex)
      }

      if (fixationIndex > 0) {
        const isTransition =
          mode === 'fixation' ||
          !arraysHaveSameElements(prevIndices, currIndices)

        if (isTransition) {
          const rowCount = prevIndices.length
          const colCount = currIndices.length
          for (let p = 0; p < rowCount; p++) {
            const from = prevIndices[p]
            const rowOffset = from * size
            for (let c = 0; c < colCount; c++) {
              const to = currIndices[c]
              const cellIdx = rowOffset + to
              sumMatrix[cellIdx]++
              dwellTimeMatrix[cellIdx] += prevDuration
              dwellCountMatrix[cellIdx]++
              totalTransitions++
            }
          }
        } else if (mode === 'visit') {
          prevDuration += reader.getSegmentEnd(segmentIndex) - reader.getSegmentStart(segmentIndex)
          continue
        }
      }

      prevIndices = currIndices
      prevDuration = reader.getSegmentEnd(segmentIndex) - reader.getSegmentStart(segmentIndex)
      fixationIndex++
    }
  }

  return {
    sumMatrix,
    dwellTimeMatrix,
    dwellCountMatrix,
    totalTransitions,
  }
}
