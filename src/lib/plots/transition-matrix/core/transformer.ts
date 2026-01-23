import {
  getParticipants,
  getAois,
  getData,
} from '$lib/gaze-data/front-process/stores/dataStore'
import { formatDecimal } from '$lib/shared/utils/mathUtils'
import { AggregationMethod } from '../const'
import type { TransitionMatrixData } from '../types'
import { collectTransitionMetrics } from './collector'

/**
 * High-level function to get full transition matrix data for the UI.
 */
export function getTransitionMatrixData(
  stimulusId: number,
  groupId: number,
  aggregationMethod: AggregationMethod
): TransitionMatrixData {
  const participants = getParticipants(groupId, stimulusId)
  const participantIds = participants.map(p => p.id)
  const aoiList = getAois(stimulusId)
  const data = getData()

  const aoiLabels = [
    ...aoiList.map(aoi => aoi.displayedName),
    data.noAoiTreatment.displayedName,
  ]

  const size = aoiList.length + 1
  if (participantIds.length === 0) {
    return {
      matrix: new Float64Array(size * size),
      aoiLabels,
      aoiList,
    }
  }

  // Determine mode for collector
  const collectMode =
    aggregationMethod === AggregationMethod.SEGMENT_DWELL_TIME
      ? 'visit'
      : 'fixation'
  const metrics = collectTransitionMetrics(
    stimulusId,
    participantIds,
    aoiList,
    collectMode
  )

  let resultMatrix: Float64Array

  switch (aggregationMethod) {
    case AggregationMethod.FREQUENCY_RELATIVE:
      resultMatrix = transformToRelativeFrequency(
        metrics.sumMatrix,
        metrics.totalTransitions,
        size
      )
      break
    case AggregationMethod.PROBABILITY:
      resultMatrix = transformToProbability(metrics.sumMatrix, size)
      break
    case AggregationMethod.PROBABILITY_2:
      resultMatrix = transformToKStepProbability(metrics.sumMatrix, size, 2)
      break
    case AggregationMethod.PROBABILITY_3:
      resultMatrix = transformToKStepProbability(metrics.sumMatrix, size, 3)
      break
    case AggregationMethod.DWELL_TIME:
    case AggregationMethod.SEGMENT_DWELL_TIME:
      resultMatrix = transformToAverageDwellTime(
        metrics.dwellTimeMatrix,
        metrics.dwellCountMatrix,
        size
      )
      break
    case AggregationMethod.SUM:
    default:
      resultMatrix = metrics.sumMatrix
      break
  }

  return {
    matrix: resultMatrix,
    aoiLabels,
    aoiList,
  }
}

function transformToRelativeFrequency(
  matrix: Float64Array,
  total: number,
  size: number
): Float64Array {
  const totalCells = size * size
  const result = new Float64Array(totalCells)
  if (total === 0) return result

  for (let i = 0; i < totalCells; i++) {
    result[i] = formatDecimal((matrix[i] / total) * 100)
  }
  return result
}

function transformToProbability(
  matrix: Float64Array,
  size: number
): Float64Array {
  const result = new Float64Array(size * size)

  for (let i = 0; i < size; i++) {
    const rowOffset = i * size
    let rowSum = 0
    for (let j = 0; j < size; j++) rowSum += matrix[rowOffset + j]

    if (rowSum > 0) {
      for (let j = 0; j < size; j++) {
        result[rowOffset + j] = formatDecimal(
          (matrix[rowOffset + j] / rowSum) * 100
        )
      }
    }
  }
  return result
}

function transformToKStepProbability(
  matrix: Float64Array,
  size: number,
  k: number
): Float64Array {
  // 1. Get 1-step probability matrix (0-1)
  const P = new Float64Array(size * size)
  for (let i = 0; i < size; i++) {
    const rowOffset = i * size
    let rowSum = 0
    for (let j = 0; j < size; j++) rowSum += matrix[rowOffset + j]
    if (rowSum > 0) {
      for (let j = 0; j < size; j++)
        P[rowOffset + j] = matrix[rowOffset + j] / rowSum
    }
  }

  // 2. Power of matrix
  const Pk = matrixPower(P, size, k)

  // 3. Convert to formatted percentages
  const result = new Float64Array(size * size)
  for (let i = 0; i < size; i++) {
    const rowOffset = i * size
    let rowSum = 0
    for (let j = 0; j < size; j++) rowSum += Pk[rowOffset + j]

    for (let j = 0; j < size; j++) {
      // Renormalize slightly if needed and convert to %
      const val = rowSum > 0 ? Pk[rowOffset + j] / rowSum : 0
      result[rowOffset + j] = formatDecimal(val * 100)
    }
  }
  return result
}

function transformToAverageDwellTime(
  dwellTime: Float64Array,
  dwellCount: Int32Array,
  size: number
): Float64Array {
  const totalCells = size * size
  const result = new Float64Array(totalCells)

  for (let i = 0; i < totalCells; i++) {
    const count = dwellCount[i]
    result[i] = count > 0 ? formatDecimal(dwellTime[i] / count) : 0
  }
  return result
}

function multiply(
  A: Float64Array,
  B: Float64Array,
  size: number
): Float64Array {
  const C = new Float64Array(size * size)
  for (let i = 0; i < size; i++) {
    const iOffset = i * size
    for (let k = 0; k < size; k++) {
      const aik = A[iOffset + k]
      if (aik === 0) continue
      const kOffset = k * size
      for (let j = 0; j < size; j++) {
        C[iOffset + j] += aik * B[kOffset + j]
      }
    }
  }
  return C
}

function matrixPower(P: Float64Array, size: number, k: number): Float64Array {
  if (k === 1) return P

  let res: Float64Array | null = null
  let base = P

  while (k > 0) {
    if (k % 2 === 1) {
      res = res ? multiply(res, base, size) : base
    }
    base = multiply(base, base, size)
    k = Math.floor(k / 2)
  }

  return res || P
}
