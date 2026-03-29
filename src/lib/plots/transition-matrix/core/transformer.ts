import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAoiRaw } from '$lib/data/engine/utils/interpreters'
import { formatDecimal } from '$lib/shared/utils/mathUtils'
import { MatrixAggregationMethod } from '../const'
import type { TransitionMatrixData } from '../types'
import { collectTransitionMetrics } from './collector'

export function getTransitionMatrixData(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  aggregationMethod: MatrixAggregationMethod
): TransitionMatrixData {
  const participantIds = getParticipantIdsForGroup(engine, groupId, stimulusId)
  const aoiList = getVisibleAois(engine, stimulusId)
  const size = aoiList.length + 1
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const aoiLabels = [
    ...aoiList.map(aoi => aoi.displayedName),
    meta.noAoiTreatment.displayedName,
  ]

  if (participantIds.length === 0) {
    return {
      matrix: new Float64Array(size * size),
      aoiLabels,
      aoiList,
    }
  }

  const collectMode =
    aggregationMethod === MatrixAggregationMethod.SEGMENT_DWELL_TIME
      ? 'visit'
      : 'fixation'
  const metrics = collectTransitionMetrics(
    engine,
    stimulusId,
    participantIds,
    aoiList,
    collectMode
  )

  let matrix: Float64Array

  switch (aggregationMethod) {
    case MatrixAggregationMethod.FREQUENCY_RELATIVE:
      matrix = transformToRelativeFrequency(
        metrics.sumMatrix,
        metrics.totalTransitions
      )
      break
    case MatrixAggregationMethod.PROBABILITY:
      matrix = transformToProbability(metrics.sumMatrix, size)
      break
    case MatrixAggregationMethod.PROBABILITY_2:
      matrix = transformToKStepProbability(metrics.sumMatrix, size, 2)
      break
    case MatrixAggregationMethod.PROBABILITY_3:
      matrix = transformToKStepProbability(metrics.sumMatrix, size, 3)
      break
    case MatrixAggregationMethod.DWELL_TIME:
    case MatrixAggregationMethod.SEGMENT_DWELL_TIME:
      matrix = transformToAverageDwellTime(
        metrics.dwellTimeMatrix,
        metrics.dwellCountMatrix
      )
      break
    case MatrixAggregationMethod.SUM:
    default:
      matrix = metrics.sumMatrix
      break
  }

  return { matrix, aoiLabels, aoiList }
}

function getParticipantOrderVector(engine: DataEngine): number[] {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.participants.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.participants.data.length }, (_, i) => i)
  }
  return order
}

function getParticipantIdsForGroup(
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): number[] {
  const meta = engine.metadata
  const reader = engine.getReader()
  if (!meta || !reader) throw new Error('Data engine metadata not available')

  const participantOrder = getParticipantOrderVector(engine)
  if (groupId === -1) return participantOrder
  if (groupId === -2) {
    return participantOrder.filter(
      participantId => reader.getSegmentCount(stimulusId, participantId) > 0
    )
  }

  const group = meta.participantsGroups.find(candidate => candidate.id === groupId)
  if (!group) throw new Error(`Participants group with id ${groupId} does not exist`)
  return group.participantsIds
}

function getVisibleAois(
  engine: DataEngine,
  stimulusId: number
) {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const stimulusAois = meta.aois.data[stimulusId]
  if (!stimulusAois) throw new Error(`AOI data for stimulus ${stimulusId} not found`)

  const order = meta.aois.orderVector?.[stimulusId]
  const ids =
    order == null
      ? Array.from({ length: stimulusAois.length }, (_, i) => i)
      : order

  const hidden = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const uniqueMappedIds = new Set<number>()

  for (let i = 0; i < ids.length; i++) {
    const rawId = ids[i]
    if (hiddenSet?.has(rawId)) continue
    uniqueMappedIds.add(engine.getAoiMapping(stimulusId, rawId))
  }

  return Array.from(uniqueMappedIds, aoiId => getAoiRaw(stimulusId, aoiId, meta))
}

export function transformToRelativeFrequency(
  matrix: Float64Array,
  total: number
): Float64Array {
  if (total === 0) return new Float64Array(matrix.length)
  const result = new Float64Array(matrix.length)
  for (let i = 0; i < matrix.length; i++) {
    result[i] = formatDecimal((matrix[i] / total) * 100)
  }
  return result
}

export function transformToProbability(
  matrix: Float64Array,
  size: number
): Float64Array {
  const result = new Float64Array(matrix.length)
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

export function transformToKStepProbability(
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
      for (let j = 0; j < size; j++) {
        P[rowOffset + j] = matrix[rowOffset + j] / rowSum
      }
    }
  }

  // 2. Power of matrix
  const Pk = matrixPower(P, size, k)

  // 3. Convert to formatted percentages
  const result = new Float64Array(size * size)
  for (let i = 0; i < size * size; i++) {
    result[i] = formatDecimal(Pk[i] * 100)
  }
  return result
}

export function transformToAverageDwellTime(
  dwellTime: Float64Array,
  dwellCount: Int32Array
): Float64Array {
  const result = new Float64Array(dwellTime.length)
  for (let i = 0; i < dwellTime.length; i++) {
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

  if (k > 1) {
    let base = P
    let exp = k
    // Working on a copy is implied by multiply returning new C
    // But we need a separate accumulator if we do proper power
    // For k=2,3 simple sequential mult is fine
    let acc: Float64Array | null = null

    while (exp > 0) {
      if (exp % 2 === 1) acc = acc ? multiply(acc, base, size) : base
      if (exp > 1) base = multiply(base, base, size)
      exp = Math.floor(exp / 2)
    }
    return acc || P
  }
  return P
}
