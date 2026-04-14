/**
 * Transformer for evolving metrics data.
 * Orchestrates per-participant collection, applies sliding window pooling,
 * computes global value range, and assembles the final result.
 *
 * Empty bins (no fixations) are represented as NaN — the renderer shows these
 * as a distinct "no data" color rather than interpolating through zero.
 */
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import {
  getParticipants,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type {
  EvolvingMetricsSettings,
  EvolvingMetricsResult,
  EvolvingMetricsParticipant,
} from '../types'
import { collectParticipantBinnedFixations } from './collector'

/**
 * Converts a window multiplier to the number of bins in the sliding window.
 * 0 → 0 (tumbling), 1 → 3, 2 → 5, 3 → 7, ...
 */
export function multiplierToBins(multiplier: number): number {
  if (multiplier <= 0) return 0
  return 2 * multiplier + 1
}

/**
 * Converts a window multiplier + step size to the effective window size in ms.
 */
export function multiplierToMs(multiplier: number, stepSize: number): number {
  return multiplierToBins(multiplier) * stepSize
}

/**
 * Main data pipeline for the Evolving Metrics plot.
 */
export function getEvolvingMetricsData(
  engine: DataEngine,
  settings: Pick<
    EvolvingMetricsSettings,
    'stimulusId' | 'groupId' | 'stepSize' | 'windowMultiplier'
  > & {
    timelineMin?: number
    timelineMax?: number
  }
): EvolvingMetricsResult {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine not initialized')

  const { stimulusId, groupId, stepSize, windowMultiplier } = settings

  // 1. Get participants
  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const participantEntities = getParticipants(engine, groupId, stimulusId)
  const numParticipants = participantIds.length

  // 2. Compute timeline bounds
  let maxTime = 0
  for (let i = 0; i < numParticipants; i++) {
    const time = getParticipantEndTime(engine, stimulusId, participantIds[i])
    if (time > maxTime) maxTime = time
  }

  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const safeMaxTime = Math.max(1, timelineMax - timelineMin)

  const safeStepSize = Math.max(1, stepSize)
  const binCount = Math.max(1, Math.ceil(safeMaxTime / safeStepSize))
  const effectiveMaxTime = binCount * safeStepSize

  // 3. Compute window from multiplier
  const safeMultiplier = Math.max(0, windowMultiplier | 0)
  const windowBins = multiplierToBins(safeMultiplier)

  let valueMin = Infinity
  let valueMax = -Infinity
  const participants: EvolvingMetricsParticipant[] = new Array(numParticipants)

  for (let p = 0; p < numParticipants; p++) {
    const pid = participantIds[p]
    const entity = participantEntities[p]

    const { fixationDurationSum, fixationCount } =
      collectParticipantBinnedFixations(
        engine,
        stimulusId,
        pid,
        binCount,
        safeStepSize,
        timelineMin
      )

    // Compute per-position mean by pooling fixations across the window.
    // Edges use a truncated window (fewer bins contribute).
    const halfWindow = windowBins > 1 ? (windowBins >> 1) | 0 : 0
    const values = new Float32Array(binCount)

    for (let i = 0; i < binCount; i++) {
      const wStart = Math.max(0, i - halfWindow)
      const wEnd = Math.min(binCount - 1, i + halfWindow)

      let totalSum = 0
      let totalCount = 0
      for (let j = wStart; j <= wEnd; j++) {
        totalSum += fixationDurationSum[j]
        totalCount += fixationCount[j]
      }

      values[i] = totalCount > 0 ? totalSum / totalCount : NaN
    }

    // Track global min/max (ignoring NaN)
    for (let i = 0; i < binCount; i++) {
      const v = values[i]
      if (v !== v) continue // NaN check
      if (v < valueMin) valueMin = v
      if (v > valueMax) valueMax = v
    }

    participants[p] = {
      id: pid,
      label: entity?.displayedName ?? entity?.originalName ?? `P${pid}`,
      values,
    }
  }

  // Handle edge cases
  if (valueMin === Infinity) valueMin = 0
  if (valueMax <= valueMin) valueMax = valueMin + 1

  // 4. Build result
  const timeline = createAdaptiveTimeline(
    timelineMin,
    timelineMin + effectiveMaxTime,
    6
  )

  return {
    participants,
    timeline,
    binCount,
    stepSize: safeStepSize,
    windowMultiplier: safeMultiplier,
    windowMs: multiplierToMs(safeMultiplier, safeStepSize),
    maxTime: timelineMin + effectiveMaxTime,
    valueMin,
    valueMax,
  }
}
