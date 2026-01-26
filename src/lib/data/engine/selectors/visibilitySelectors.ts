import { engine } from '../DataEngine.svelte'

/**
 * Returns the visibility of the AOI for the given stimulus and participant.
 */
export const getAoiVisibility = (
  stimulusId: number,
  aoiId: number,
  participantId: number | null = null
): number[] | null => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const mappedAoiId = engine.getAoiMapping(stimulusId, aoiId)
  const dynamicVisibility = meta.aois.dynamicVisibility

  const baseKey = `${stimulusId}_${mappedAoiId}`
  let result = dynamicVisibility[baseKey] ?? null

  if (participantId != null) {
    const extendedKey = `${baseKey}_${participantId}`
    result = dynamicVisibility[extendedKey] ?? result
  }

  // If this is a representative AOI, we need to merge visibilities from all AOIs in the group
  if (mappedAoiId === aoiId) {
    const stimulusAois = meta.aois.data[stimulusId]
    const aoiCount = stimulusAois?.length ?? 0
    let allVisibilities: number[][] | null = null

    for (let id = 0; id < aoiCount; id++) {
      if (id === aoiId) continue
      if (engine.getAoiMapping(stimulusId, id) === mappedAoiId) {
        if (!allVisibilities) {
          allVisibilities = result ? [result] : []
        }
        const otherKey = `${stimulusId}_${id}`
        let otherVisibility = dynamicVisibility[otherKey] ?? null
        if (participantId != null) {
          const otherExtendedKey = `${otherKey}_${participantId}`
          otherVisibility =
            dynamicVisibility[otherExtendedKey] ?? otherVisibility
        }
        if (otherVisibility) allVisibilities.push(otherVisibility)
      }
    }

    if (allVisibilities && allVisibilities.length > 0) {
      const ranges: Array<[number, number]> = []
      for (let i = 0; i < allVisibilities.length; i++) {
        const visibility = allVisibilities[i]
        if (visibility.length === 0) continue
        const sorted = [...visibility].sort((a, b) => a - b)
        for (let j = 0; j < sorted.length; j += 2) {
          const start = sorted[j]
          const end =
            j + 1 < sorted.length ? sorted[j + 1] : Number.MAX_SAFE_INTEGER
          ranges.push([start, end])
        }
      }

      if (ranges.length === 0) return result

      ranges.sort((a, b) => a[0] - b[0])
      const mergedRanges: Array<[number, number]> = []
      let currentRange = ranges[0]

      for (let i = 1; i < ranges.length; i++) {
        const nextRange = ranges[i]
        if (nextRange[0] <= currentRange[1]) {
          if (nextRange[1] > currentRange[1]) currentRange[1] = nextRange[1]
        } else {
          mergedRanges.push([currentRange[0], currentRange[1]])
          currentRange = nextRange
        }
      }
      mergedRanges.push([currentRange[0], currentRange[1]])

      const mergedToggles: number[] = []
      for (let i = 0; i < mergedRanges.length; i++) {
        const [start, end] = mergedRanges[i]
        mergedToggles.push(start)
        if (end < Number.MAX_SAFE_INTEGER) mergedToggles.push(end)
      }
      result = mergedToggles
    }
  }

  return result
}

/**
 * Returns boolean value indicating if the AOI has any visibility set for the given stimulus.
 */
export const hasStimulusAoiVisibility = (stimulusId: number): boolean => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const prefix = `${stimulusId}_`
  for (const key in meta.aois.dynamicVisibility) {
    if (key.startsWith(prefix)) return true
  }
  return false
}
