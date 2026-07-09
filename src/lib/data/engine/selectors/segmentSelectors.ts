import { type SegmentInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import { getNumberOfParticipants } from './baseSelectors'
import { getHiddenAois } from './aoiSelectors'
import { getAoiRaw, getCategoryRaw } from '../utils/interpreters'

export const getNumberOfSegments = (
  engine: DataEngine,
  stimulusId: number,
  participantId: number
): number => {
  const reader = engine.getReader()
  if (!reader) throw new Error('Binary reader not available')
  return reader.getSegmentCount(stimulusId, participantId)
}

export const getParticipantEndTime = (
  engine: DataEngine,
  stimulusId: number,
  particIndex: number
): number => {
  const reader = engine.getReader()
  if (!reader) throw new Error('Binary reader not available')
  return reader.getParticipantEndTime(stimulusId, particIndex)
}

export const getStimulusHighestEndTime = (
  engine: DataEngine,
  stimulusIndex: number
): number => {
  const numParticipants = getNumberOfParticipants(engine)
  let max = 0
  for (let i = 0; i < numParticipants; i++) {
    max = Math.max(max, getParticipantEndTime(engine, stimulusIndex, i))
  }
  return max
}

export const getSegment = (
  engine: DataEngine,
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

  const hidden = getHiddenAois(engine, stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const rawIds = reader.getRawAois(absoluteIndex)

  const uniqueAois = new Set(
    rawIds
      .filter(rawId => !hiddenSet?.has(rawId))
      .map(rawId => engine.getAoiMapping(stimulusId, rawId))
  )
  const aoi = Array.from(uniqueAois).map(aoiId =>
    getAoiRaw(stimulusId, aoiId, metadata)
  )

  const categoryId = reader.getSegmentCategory(absoluteIndex)

  return {
    id: segmentId,
    start: reader.getSegmentStart(absoluteIndex),
    end: reader.getSegmentEnd(absoluteIndex),
    aoi,
    category: getCategoryRaw(categoryId, metadata),
  }
}

