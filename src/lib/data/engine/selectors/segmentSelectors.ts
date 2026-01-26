import {
  type SegmentInterpretedDataType,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import { engine } from '../DataEngine.svelte'
import { getNumberOfParticipants } from './baseSelectors'
import { getHiddenAois } from './aoiSelectors'
import { getAoiRaw, getCategoryRaw } from '../utils/interpreters'

export const getNumberOfSegments = (
  stimulusId: number,
  participantId: number
): number => {
  const reader = engine.getReader()
  if (!reader) throw new Error('Binary reader not available')
  return reader.getSegmentCount(stimulusId, participantId)
}

export const getParticipantEndTime = (
  stimulusId: number,
  particIndex: number
): number => {
  const reader = engine.getReader()
  if (!reader) throw new Error('Binary reader not available')
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
    const end = getParticipantEndTime(stimulusIndex, participantIndex)
    if (end > max) max = end
  }
  return max
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
  const metadata = engine.metadata
  if (!reader || !metadata)
    throw new Error('Data engine metadata not available')

  const range = reader.getSegmentRange(stimulusId, participantId)
  const segmentCount = range.endIndex - range.startIndex

  if (segmentCount === 0 || limit === 0 || offset >= segmentCount) return []

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const result: SegmentInterpretedDataType[] = []
  const aoiCache = new Map<number, ExtendedInterpretedDataType>()
  const categoryCache = new Map<number, ExtendedInterpretedDataType>()

  const categoryFilter = whereCategories ? new Set(whereCategories) : null
  const aoiFilter = whereAois ? new Set(whereAois) : null
  const uniqueAois = new Set<number>()

  const processFrom = range.startIndex + offset
  const processTo = Math.min(
    range.endIndex,
    processFrom + (limit ?? segmentCount)
  )

  for (let i = processFrom; i < processTo; i++) {
    const categoryId = reader.getSegmentCategory(i)
    if (categoryFilter && !categoryFilter.has(categoryId)) continue

    const rawIds = reader.getRawAois(i)
    uniqueAois.clear()

    for (let j = 0; j < rawIds.length; j++) {
      const rawId = rawIds[j]
      if (hiddenSet?.has(rawId)) continue
      uniqueAois.add(engine.getAoiMapping(stimulusId, rawId))
    }

    if (aoiFilter) {
      let hasMatch = false
      for (const id of uniqueAois) {
        if (aoiFilter.has(id)) {
          hasMatch = true
          break
        }
      }
      if (!hasMatch) continue
    }

    const aoi: ExtendedInterpretedDataType[] = []
    for (const aoiId of uniqueAois) {
      let cached = aoiCache.get(aoiId)
      if (!cached) {
        cached = getAoiRaw(stimulusId, aoiId, metadata)
        aoiCache.set(aoiId, cached)
      }
      aoi.push(cached)
    }

    let category = categoryCache.get(categoryId)
    if (!category) {
      category = getCategoryRaw(categoryId, metadata)
      categoryCache.set(categoryId, category)
    }

    result.push({
      id: i - range.startIndex,
      start: reader.getSegmentStart(i),
      end: reader.getSegmentEnd(i),
      aoi,
      category,
    })

    if (limit !== null && result.length >= limit) break
  }

  return result
}

export const getSegment = (
  stimulusId: number,
  participantId: number,
  segmentId: number
): SegmentInterpretedDataType => {
  const reader = engine.getReader()
  const metadata = engine.metadata
  if (!reader || !metadata) {
    throw new Error('Data engine not initialized')
  }

  const range = reader.getSegmentRange(stimulusId, participantId)
  const absoluteIndex = range.startIndex + segmentId

  if (absoluteIndex >= range.endIndex) {
    throw new Error(`Segment ${segmentId} out of range`)
  }

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const rawIds = reader.getRawAois(absoluteIndex)
  const aoi: ExtendedInterpretedDataType[] = []
  const uniqueAois = new Set<number>()

  for (let i = 0; i < rawIds.length; i++) {
    const rawId = rawIds[i]
    if (hiddenSet?.has(rawId)) continue
    uniqueAois.add(engine.getAoiMapping(stimulusId, rawId))
  }

  for (const aoiId of uniqueAois) {
    aoi.push(getAoiRaw(stimulusId, aoiId, metadata))
  }

  const categoryId = reader.getSegmentCategory(absoluteIndex)

  return {
    id: segmentId,
    start: reader.getSegmentStart(absoluteIndex),
    end: reader.getSegmentEnd(absoluteIndex),
    aoi,
    category: getCategoryRaw(categoryId, metadata),
  }
}
