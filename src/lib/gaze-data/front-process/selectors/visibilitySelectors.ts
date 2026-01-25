import { getData } from './baseSelectors'
import { getAoiIdMapping } from './baseSelectors'

/**
 * Returns the visibility of the AOI for the given stimulus and participant.
 */
export const getAoiVisibility = (
  stimulusId: number,
  aoiId: number,
  participantId: number | null = null
): number[] | null => {
  const mappedAoiId = getAoiIdMapping(stimulusId, aoiId)
  const data = getData()

  const baseKey = `${stimulusId}_${mappedAoiId}`
  let result = data.aois.dynamicVisibility[baseKey] ?? null

  if (participantId != null) {
    const extendedKey = `${baseKey}_${participantId}`
    result = data.aois.dynamicVisibility[extendedKey] ?? result
  }

  if (mappedAoiId === aoiId) {
    const mappedAoiIds: number[] = []
    const stimulusAois = data.aois.data[stimulusId]
    const aoiCount = stimulusAois?.length ?? 0

    for (let id = 0; id < aoiCount; id++) {
      if (id === aoiId) continue
      if (getAoiIdMapping(stimulusId, id) === mappedAoiId) {
        mappedAoiIds.push(id)
      }
    }

    if (mappedAoiIds.length > 0) {
      const allVisibilities: (number[] | null)[] = result ? [result] : []

      for (const otherAoiId of mappedAoiIds) {
        const otherKey = `${stimulusId}_${otherAoiId}`
        let otherVisibility = data.aois.dynamicVisibility[otherKey] ?? null

        if (participantId != null) {
          const otherExtendedKey = `${otherKey}_${participantId}`
          otherVisibility =
            data.aois.dynamicVisibility[otherExtendedKey] ?? otherVisibility
        }

        if (otherVisibility) {
          allVisibilities.push(otherVisibility)
        }
      }

      if (allVisibilities.length > 0) {
        const ranges: Array<[number, number]> = []

        for (const visibility of allVisibilities) {
          if (!visibility || visibility.length === 0) continue
          const sortedVisibility = [...visibility].sort((a, b) => a - b)

          for (let i = 0; i < sortedVisibility.length; i += 2) {
            const start = sortedVisibility[i]
            const end =
              i + 1 < sortedVisibility.length
                ? sortedVisibility[i + 1]
                : Number.MAX_SAFE_INTEGER

            ranges.push([start, end])
          }
        }

        if (ranges.length === 0) return null

        ranges.sort((a, b) => a[0] - b[0])

        const mergedRanges: Array<[number, number]> = []
        let currentRange = ranges[0]

        for (let i = 1; i < ranges.length; i++) {
          const nextRange = ranges[i]
          if (
            nextRange[0] <= currentRange[1] ||
            Math.abs(nextRange[0] - currentRange[1]) < 1e-10
          ) {
            currentRange[1] = Math.max(currentRange[1], nextRange[1])
          } else {
            mergedRanges.push([...currentRange])
            currentRange = nextRange
          }
        }
        mergedRanges.push([...currentRange])

        const mergedToggles: number[] = []
        for (const [start, end] of mergedRanges) {
          mergedToggles.push(start)
          if (end < Number.MAX_SAFE_INTEGER) {
            mergedToggles.push(end)
          }
        }
        result = mergedToggles
      }
    }
  }

  return result
}

/**
 * Returns boolean value indicating if the AOI has any visibility set for the given stimulus.
 */
export const hasStimulusAoiVisibility = (stimulusId: number): boolean => {
  return Object.keys(getData().aois.dynamicVisibility).some(key =>
    key.startsWith(`${stimulusId}_`)
  )
}
