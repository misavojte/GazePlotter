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

  if (participantIds.length === 0) {
    const size = aoiList.length + 1
    return {
      matrix: Array.from({ length: size }, () => Array(size).fill(0)),
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

  let resultMatrix: number[][]

  switch (aggregationMethod) {
    case AggregationMethod.FREQUENCY_RELATIVE:
      resultMatrix = transformToRelativeFrequency(
        metrics.sumMatrix,
        metrics.totalTransitions
      )
      break
    case AggregationMethod.PROBABILITY:
      resultMatrix = transformToProbability(metrics.sumMatrix)
      break
    case AggregationMethod.PROBABILITY_2:
      resultMatrix = transformToKStepProbability(metrics.sumMatrix, 2)
      break
    case AggregationMethod.PROBABILITY_3:
      resultMatrix = transformToKStepProbability(metrics.sumMatrix, 3)
      break
    case AggregationMethod.DWELL_TIME:
    case AggregationMethod.SEGMENT_DWELL_TIME:
      resultMatrix = transformToAverageDwellTime(
        metrics.dwellTimeMatrix,
        metrics.dwellCountMatrix
      )
      break
    case AggregationMethod.SUM:
    default:
      // Convert TypedArrays to regular arrays for the UI if needed
      resultMatrix = Array.from(metrics.sumMatrix, row => Array.from(row))
      break
  }

  return {
    matrix: resultMatrix,
    aoiLabels,
    aoiList,
  }
}

function transformToRelativeFrequency(
  matrix: Float64Array[],
  total: number
): number[][] {
  const size = matrix.length
  const result = Array.from({ length: size }, () => new Array(size))
  if (total === 0) return result.map(row => row.fill(0))

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      result[i][j] = formatDecimal((matrix[i][j] / total) * 100)
    }
  }
  return result
}

function transformToProbability(matrix: Float64Array[]): number[][] {
  const size = matrix.length
  const result = Array.from({ length: size }, () => new Array(size))

  for (let i = 0; i < size; i++) {
    let rowSum = 0
    for (let j = 0; j < size; j++) rowSum += matrix[i][j]

    if (rowSum === 0) {
      result[i].fill(0)
    } else {
      for (let j = 0; j < size; j++) {
        result[i][j] = formatDecimal((matrix[i][j] / rowSum) * 100)
      }
    }
  }
  return result
}

function transformToKStepProbability(
  matrix: Float64Array[],
  k: number
): number[][] {
  const size = matrix.length
  // 1. Get 1-step probability matrix (0-1)
  let P = Array.from({ length: size }, () => new Float64Array(size))
  for (let i = 0; i < size; i++) {
    let rowSum = 0
    for (let j = 0; j < size; j++) rowSum += matrix[i][j]
    if (rowSum > 0) {
      for (let j = 0; j < size; j++) P[i][j] = matrix[i][j] / rowSum
    }
  }

  // 2. Power of matrix
  let Pk = matrixPower(P, k)

  // 3. Convert to formatted percentages
  const result = Array.from({ length: size }, () => new Array(size))
  for (let i = 0; i < size; i++) {
    let rowSum = 0
    for (let j = 0; j < size; j++) rowSum += Pk[i][j]

    for (let j = 0; j < size; j++) {
      // Renormalize slightly if needed and convert to %
      const val = rowSum > 0 ? Pk[i][j] / rowSum : 0
      result[i][j] = formatDecimal(val * 100)
    }
  }
  return result
}

function transformToAverageDwellTime(
  dwellTime: Float64Array[],
  dwellCount: Int32Array[]
): number[][] {
  const size = dwellTime.length
  const result = Array.from({ length: size }, () => new Array(size))

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const count = dwellCount[i][j]
      result[i][j] = count > 0 ? formatDecimal(dwellTime[i][j] / count) : 0
    }
  }
  return result
}

function multiply(A: Float64Array[], B: Float64Array[]): Float64Array[] {
  const size = A.length
  const C = Array.from({ length: size }, () => new Float64Array(size))
  for (let i = 0; i < size; i++) {
    for (let k = 0; k < size; k++) {
      const aik = A[i][k]
      if (aik === 0) continue
      for (let j = 0; j < size; j++) {
        C[i][j] += aik * B[k][j]
      }
    }
  }
  return C
}

function matrixPower(P: Float64Array[], k: number): Float64Array[] {
  if (k === 1) return P

  let res: Float64Array[] | null = null
  let base = P

  while (k > 0) {
    if (k % 2 === 1) {
      res = res ? multiply(res, base) : base
    }
    base = multiply(base, base)
    k = Math.floor(k / 2)
  }

  return res || P
}
