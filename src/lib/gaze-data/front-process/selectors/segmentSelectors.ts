import {
  type SegmentInterpretedDataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'
import { getData, getNumberOfParticipants } from './baseSelectors'
import { getCategory } from './entitySelectors'
import { getHiddenAois } from './aoiSelectors'

export const getNumberOfSegments = (
  stimulusId: number,
  participantId: number
): number => {
  const reader = engine.getReader()
  if (!reader) return 0
  return reader.getSegmentCount(stimulusId, participantId)
}

export const getParticipantEndTime = (
  stimulusId: number,
  particIndex: number
): number => {
  const reader = engine.getReader()
  if (!reader) return 0
  return reader.getParticipantEndTime(stimulusId, particIndex)
}

export const getStimulusHighestEndTime = (stimulusIndex: number): number => {
  let max = 0
  const numParticipants = getNumberOfParticipants()
  for (
    let participantIndex = 0;
    participantIndex < numParticipants;
    participantIndex++
  ) {
    const lastSegmentEndTime = getParticipantEndTime(
      stimulusIndex,
      participantIndex
    )
    max = lastSegmentEndTime > max ? lastSegmentEndTime : max
  }
  return max
}

// Re-using the getAoiRaw logic from entitySelectors internally if needed,
// but better to import it or define it locally if we want segmentSelectors
// to be independent. However, entitySelectors exports getAoiRaw as a helper?
// Actually I didn't export it. I'll define it locally in entitySelectors if I need it,
// but for segments it's safer to use the public getAoiRaw if I had one.
// Let's re-define the local helper for now to avoid circular dependencies or complex exports.

const getDefaultColor = (index: number): string => {
  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dcb0f2', '#87c55f']
  return COLORS[index % COLORS.length]
}

const getAoiRaw = (
  stimulusId: number,
  aoiId: number,
  dataSnapshot: any
): ExtendedInterpretedDataType => {
  const aoiArray = dataSnapshot.aois.data[stimulusId][aoiId]
  if (aoiArray === undefined)
    throw new Error(
      `AOI with id ${aoiId} does not exist in stimulus with id ${stimulusId}`
    )
  const originalName = aoiArray[0]
  const displayedName = aoiArray[1] ?? originalName
  const color = aoiArray[2] ?? getDefaultColor(aoiId)

  return {
    id: aoiId,
    originalName,
    displayedName,
    color,
  }
}

export const getSegments = (
  stimulusId: number,
  participantId: number,
  whereCategories: number[] | null = null,
  whereAois: number[] | null = null,
  limit: number | null = null,
  offset: number = 0
): SegmentInterpretedDataType[] => {
  const reader = engine.getReader()
  if (!reader) return []

  const range = reader.getSegmentRange(stimulusId, participantId)
  const segmentCount = range.endIndex - range.startIndex

  if (segmentCount === 0 || limit === 0 || offset >= segmentCount) return []

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const result: SegmentInterpretedDataType[] = []
  const aoiCache: Record<number, ExtendedInterpretedDataType> = {}
  const categoryCache: Record<number, ExtendedInterpretedDataType> = {}

  const categoryFilter = whereCategories ? new Set(whereCategories) : null
  const aoiFilter = whereAois ? new Set(whereAois) : null
  const uniqueAois = new Set<number>()

  let resultCount = 0
  const processTo = Math.min(
    range.endIndex,
    range.startIndex + offset + (limit ?? segmentCount)
  )

  for (
    let i = range.startIndex + offset;
    i < processTo && (limit === null || resultCount < limit);
    i++
  ) {
    const categoryId = reader.getSegmentCategory(i)
    if (categoryFilter && !categoryFilter.has(categoryId)) continue

    const rawIds = reader.getRawAois(i)

    if (aoiFilter) {
      let hasMatchingAoi = false
      for (let j = 0; j < rawIds.length; j++) {
        const rawId = rawIds[j]
        if (hiddenSet && hiddenSet.has(rawId)) continue
        const mappedId = engine.getAoiMapping(stimulusId, rawId)
        if (aoiFilter.has(mappedId)) {
          hasMatchingAoi = true
          break
        }
      }
      if (!hasMatchingAoi) continue
    }

    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)

    uniqueAois.clear()
    for (let j = 0; j < rawIds.length; j++) {
      const rawId = rawIds[j]
      if (hiddenSet && hiddenSet.has(rawId)) continue
      const mappedId = engine.getAoiMapping(stimulusId, rawId)
      uniqueAois.add(mappedId)
    }

    const aoi: ExtendedInterpretedDataType[] = []
    const dataSnapshot = getData()
    for (const aoiId of uniqueAois) {
      if (!aoiCache[aoiId])
        aoiCache[aoiId] = getAoiRaw(stimulusId, aoiId, dataSnapshot)
      aoi.push(aoiCache[aoiId])
    }

    if (!categoryCache[categoryId]) {
      categoryCache[categoryId] = getCategory(categoryId)
    }

    result.push({
      id: i - range.startIndex,
      start,
      end,
      aoi,
      category: categoryCache[categoryId],
    })

    resultCount++
  }

  return result
}

export const getSegment = (
  stimulusId: number,
  participantId: number,
  segmentId: number
): SegmentInterpretedDataType => {
  const segments = getSegments(
    stimulusId,
    participantId,
    null,
    null,
    1,
    segmentId
  )
  if (segments.length === 0) {
    throw new Error(
      `Segment ${segmentId} not found for stimulus ${stimulusId} and participant ${participantId}`
    )
  }
  return segments[0]
}
