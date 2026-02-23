import { getSegments } from '$lib/data/engine'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { createArray } from '$lib/shared/utils/mathUtils'
import type { ParticipantBarMetrics } from '../types'

/**
 * Collects all relevant bar plot metrics for participants in a single pass.
 * This is significantly more efficient than calling individual collectors
 * as it avoids redundant segment fetches and repeated traversals.
 */
export function collectParticipantBarMetrics(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[],
  timelineStart = 0,
  timelineEnd = 0
): ParticipantBarMetrics[] {
  const result: ParticipantBarMetrics[] = []
  const aoiCount = aois.length
  const noAoiIndex = aoiCount
  const anyFixationIndex = aoiCount + 1
  const totalSlots = aoiCount + 2

  // Create AOI ID to index map for O(1) lookup
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) {
    aoiLookup.set(aois[i].id, i)
  }

  for (const participantId of participantIds) {
    const metrics: ParticipantBarMetrics = {
      dwellTime: createArray(totalSlots, 0),
      ttff: createArray(totalSlots, -1),
      fixationCount: createArray(totalSlots, 0),
      hitRatio: createArray(totalSlots, 0),
      entryCount: createArray(totalSlots, 0),
      dwellDurations: Array.from({ length: totalSlots }, () => []),
      firstFixationDuration: createArray(totalSlots, -1),
      avgFixationDuration: Array.from({ length: totalSlots }, () => []),
    }

    const segments = getSegments(stimulusId, participantId, [0])
    if (segments.length === 0) {
      result.push(metrics)
      continue
    }

    // Tracking for entries and dwell accumulation
    const previousAois = new Set<number>()
    const activeDwellDurations = new Map<number, number>() // index -> duration
    let wasInNoAoi = false
    let currentNoAoiDwell = 0
    let currentAnyFixationDwell = 0

    metrics.hitRatio[anyFixationIndex] = 1

    for (const segment of segments) {
      // Check if segment is fully outside the specified timeline range
      if (timelineEnd > 0 && segment.start >= timelineEnd) continue
      if (segment.end <= timelineStart) continue

      const duration = segment.end - segment.start
      const startTime = segment.start

      // TTFF for AnyFixation
      if (metrics.ttff[anyFixationIndex] === -1) {
        metrics.ttff[anyFixationIndex] = startTime
        metrics.firstFixationDuration[anyFixationIndex] = duration
      }
      metrics.fixationCount[anyFixationIndex]++
      metrics.avgFixationDuration[anyFixationIndex].push(duration)

      const currentAoiIndices: number[] = []
      for (const aoi of segment.aoi) {
        const idx = aoiLookup.get(aoi.id)
        if (idx !== undefined) currentAoiIndices.push(idx)
      }

      if (currentAoiIndices.length === 0) {
        // No-AOI case
        if (!wasInNoAoi) {
          metrics.entryCount[noAoiIndex]++
          metrics.entryCount[anyFixationIndex]++
          currentNoAoiDwell = duration
          currentAnyFixationDwell = duration
          wasInNoAoi = true
        } else {
          currentNoAoiDwell += duration
          currentAnyFixationDwell += duration
        }

        if (metrics.ttff[noAoiIndex] === -1) {
          metrics.ttff[noAoiIndex] = startTime
          metrics.firstFixationDuration[noAoiIndex] = duration
        }
        metrics.hitRatio[noAoiIndex] = 1
        metrics.fixationCount[noAoiIndex]++
        metrics.dwellTime[noAoiIndex] += duration
        metrics.dwellTime[anyFixationIndex] += duration
        metrics.avgFixationDuration[noAoiIndex].push(duration)

        // Close any AOI dwells
        for (const [idx, d] of activeDwellDurations.entries()) {
          metrics.dwellDurations[idx].push(d)
        }
        activeDwellDurations.clear()
        previousAois.clear()
      } else {
        // In AOI(s)
        if (wasInNoAoi) {
          metrics.dwellDurations[noAoiIndex].push(currentNoAoiDwell)
          metrics.dwellDurations[anyFixationIndex].push(currentAnyFixationDwell)
          currentNoAoiDwell = 0
          currentAnyFixationDwell = 0
          wasInNoAoi = false
        }

        // Check for "AnyFixation" dwell transition
        const setsMatch =
          currentAoiIndices.length === previousAois.size &&
          currentAoiIndices.every(idx => previousAois.has(idx))

        if (previousAois.size > 0 && !setsMatch) {
          if (currentAnyFixationDwell > 0) {
            metrics.dwellDurations[anyFixationIndex].push(
              currentAnyFixationDwell
            )
          }
          metrics.entryCount[anyFixationIndex]++
          currentAnyFixationDwell = duration
        } else if (previousAois.size === 0) {
          metrics.entryCount[anyFixationIndex]++
          currentAnyFixationDwell = duration
        } else {
          currentAnyFixationDwell += duration
        }

        // Process current AOIs
        metrics.dwellTime[anyFixationIndex] += duration
        for (const idx of currentAoiIndices) {
          metrics.dwellTime[idx] += duration
          metrics.fixationCount[idx]++
          metrics.avgFixationDuration[idx].push(duration)
          metrics.hitRatio[idx] = 1

          if (metrics.ttff[idx] === -1) {
            metrics.ttff[idx] = startTime
            metrics.firstFixationDuration[idx] = duration
          }

          if (previousAois.has(idx)) {
            activeDwellDurations.set(
              idx,
              (activeDwellDurations.get(idx) || 0) + duration
            )
          } else {
            metrics.entryCount[idx]++
            activeDwellDurations.set(idx, duration)
          }
        }

        // Close AOIs that were left
        for (const prevIdx of previousAois) {
          let stillIn = false
          for (const currIdx of currentAoiIndices) {
            if (currIdx === prevIdx) {
              stillIn = true
              break
            }
          }
          if (!stillIn) {
            const d = activeDwellDurations.get(prevIdx)
            if (d !== undefined) metrics.dwellDurations[prevIdx].push(d)
            activeDwellDurations.delete(prevIdx)
          }
        }

        // Update previous set
        previousAois.clear()
        for (const idx of currentAoiIndices) previousAois.add(idx)
      }
    }

    // Trailing cleanup
    for (const [idx, d] of activeDwellDurations.entries()) {
      metrics.dwellDurations[idx].push(d)
    }
    if (wasInNoAoi) {
      metrics.dwellDurations[noAoiIndex].push(currentNoAoiDwell)
    }
    if (currentAnyFixationDwell > 0) {
      metrics.dwellDurations[anyFixationIndex].push(currentAnyFixationDwell)
    }

    result.push(metrics)
  }

  return result
}
