import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { createArray } from '$lib/shared/utils/mathUtils'
import type { MetricData } from './types'

export function collectMetricData(
  engine: DataEngine,
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[],
  timelineStart = 0,
  timelineEnd = 0
): MetricData[] {
  const reader = engine.getReader()
  const meta = engine.metadata
  if (!reader || !meta) throw new Error('Data engine metadata not available')

  const result: MetricData[] = []
  const aoiCount = aois.length
  const noAoiIndex = aoiCount
  const anyFixationIndex = aoiCount + 1
  const totalSlots = aoiCount + 2
  const hiddenAois = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set(hiddenAois) : null

  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) {
    aoiLookup.set(aois[i].id, i)
  }

  for (const participantId of participantIds) {
    const metrics: MetricData = {
      dwellTime: createArray(totalSlots, 0),
      ttff: createArray(totalSlots, -1),
      fixationCount: createArray(totalSlots, 0),
      hitRatio: createArray(totalSlots, 0),
      entryCount: createArray(totalSlots, 0),
      dwellDurations: Array.from({ length: totalSlots }, () => []),
      firstFixationDuration: createArray(totalSlots, -1),
      avgFixationDuration: Array.from({ length: totalSlots }, () => []),
      fixationAoiSequence: [],
      fixationTimestamps: [],
    }

    const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
    if (endIndex <= startIndex) {
      result.push(metrics)
      continue
    }

    const previousAois = new Set<number>()
    const activeDwellDurations = new Map<number, number>()
    let wasInNoAoi = false
    let currentNoAoiDwell = 0
    let currentAnyFixationDwell = 0
    const currentAoiIndicesSet = new Set<number>()

    metrics.hitRatio[anyFixationIndex] = 1

    for (let segmentIndex = startIndex; segmentIndex < endIndex; segmentIndex++) {
      if (reader.getSegmentCategory(segmentIndex) !== 0) continue

      const segmentStart = reader.getSegmentStart(segmentIndex)
      const segmentEnd = reader.getSegmentEnd(segmentIndex)

      if (timelineEnd > 0 && segmentStart >= timelineEnd) continue
      if (segmentEnd <= timelineStart) continue

      const duration = segmentEnd - segmentStart
      const startTime = segmentStart

      if (metrics.ttff[anyFixationIndex] === -1) {
        metrics.ttff[anyFixationIndex] = startTime
        metrics.firstFixationDuration[anyFixationIndex] = duration
      }
      metrics.fixationCount[anyFixationIndex]++
      metrics.avgFixationDuration[anyFixationIndex].push(duration)

      currentAoiIndicesSet.clear()
      const rawAois = reader.getRawAois(segmentIndex)
      for (let rawIndex = 0; rawIndex < rawAois.length; rawIndex++) {
        const rawAoiId = rawAois[rawIndex]
        if (hiddenAoisSet?.has(rawAoiId)) continue
        const idx = aoiLookup.get(engine.getAoiMapping(stimulusId, rawAoiId))
        if (idx !== undefined) currentAoiIndicesSet.add(idx)
      }
      const currentAoiIndices = Array.from(currentAoiIndicesSet)

      if (currentAoiIndices.length === 1) {
        metrics.fixationAoiSequence.push(currentAoiIndices[0])
        metrics.fixationTimestamps.push(segmentStart)
      }

      if (currentAoiIndices.length === 0) {
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

        for (const [idx, d] of activeDwellDurations.entries()) {
          metrics.dwellDurations[idx].push(d)
        }
        activeDwellDurations.clear()
        previousAois.clear()
      } else {
        if (wasInNoAoi) {
          metrics.dwellDurations[noAoiIndex].push(currentNoAoiDwell)
          metrics.dwellDurations[anyFixationIndex].push(currentAnyFixationDwell)
          currentNoAoiDwell = 0
          currentAnyFixationDwell = 0
          wasInNoAoi = false
        }

        const setsMatch =
          currentAoiIndices.length === previousAois.size &&
          currentAoiIndices.every(idx => previousAois.has(idx))

        if (previousAois.size > 0 && !setsMatch) {
          if (currentAnyFixationDwell > 0) {
            metrics.dwellDurations[anyFixationIndex].push(currentAnyFixationDwell)
          }
          metrics.entryCount[anyFixationIndex]++
          currentAnyFixationDwell = duration
        } else if (previousAois.size === 0) {
          metrics.entryCount[anyFixationIndex]++
          currentAnyFixationDwell = duration
        } else {
          currentAnyFixationDwell += duration
        }

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
            activeDwellDurations.set(idx, (activeDwellDurations.get(idx) || 0) + duration)
          } else {
            metrics.entryCount[idx]++
            activeDwellDurations.set(idx, duration)
          }
        }

        for (const prevIdx of previousAois) {
          let stillIn = false
          for (const currIdx of currentAoiIndices) {
            if (currIdx === prevIdx) { stillIn = true; break }
          }
          if (!stillIn) {
            const d = activeDwellDurations.get(prevIdx)
            if (d !== undefined) metrics.dwellDurations[prevIdx].push(d)
            activeDwellDurations.delete(prevIdx)
          }
        }

        previousAois.clear()
        for (const idx of currentAoiIndices) previousAois.add(idx)
      }
    }

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
