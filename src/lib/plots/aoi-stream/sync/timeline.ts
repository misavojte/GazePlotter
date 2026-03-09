import {
  getParticipants,
  getParticipantEndTime,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

/**
 * Scan all active plots with the same width (w)
 * to find a synchronized timeline max that works for all of them.
 *
 * Synchronization is only applied between plots that have:
 * - Same grid width (w)
 * - No timeline clipping (absoluteStimuliLimits start=0 and end=0 for their stimulus)
 *
 * Returns the maximum participant end time across all matching plots.
 *
 * @param items - Current grid items from the workspace
 * @param targetWidth - The grid width (w) to filter by
 * @param currentStimulus - The stimulus ID of the current plot (to check its limits)
 * @param currentLimits - The absoluteStimuliLimits array from the current plot settings
 * @returns The synchronized timeline max, or null if no synchronization needed
 */
export function scanForSynchronizedTimelineMax(
  engine: DataEngine,
  items: AllGridTypes[],
  targetWidth: number,
  currentStimulus: number,
  currentLimits: [number, number][] | undefined
): number | null {
  // Check if current plot has timeline clipping
  const currentStart = currentLimits?.[currentStimulus]?.[0] ?? 0
  const currentEnd = currentLimits?.[currentStimulus]?.[1] ?? 0

  // If current plot has any clipping, don't sync
  if (currentStart !== 0 || currentEnd !== 0) return null

  // Filter relevant plots by width and type
  const candidates = items.filter(item => {
    if (item.type !== 'aoiStreamPlot') return false
    if (item.w !== targetWidth) return false

    const settings = item as any
    const stimulusId = settings.stimulusId
    const limits = settings.absoluteStimuliLimits as
      | [number, number][]
      | undefined

    // Only include plots with no timeline clipping
    const start = limits?.[stimulusId]?.[0] ?? 0
    const end = limits?.[stimulusId]?.[1] ?? 0

    return start === 0 && end === 0
  })

  if (candidates.length < 2) return null // No need to sync if only one or zero

  // Find the maximum participant end time across all candidates
  let globalMaxTime = 0

  for (const item of candidates) {
    const settings = item as any
    const stimulusId = settings.stimulusId
    const groupId = settings.groupId

    const participants = getParticipants(engine, groupId, stimulusId)
    const maxTime = participants.reduce(
      (max, p) =>
        Math.max(max, getParticipantEndTime(engine, stimulusId, p.id)),
      0
    )

    if (maxTime > globalMaxTime) {
      globalMaxTime = maxTime
    }
  }

  if (globalMaxTime <= 0) return null

  return globalMaxTime
}
