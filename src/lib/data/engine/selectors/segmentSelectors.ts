import { type SegmentInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
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

/**
 * Number of FIXATION segments (category 0) for a stimulus × participant — the
 * count the metric scan actually iterates (`reader.getFixationRange`), as
 * opposed to `getNumberOfSegments`, which counts every segment (fixations,
 * saccades, blinks). O(1) index subtraction. A recording with segments but
 * zero fixations is a capture failure: present but unusable, distinct from both
 * an absent recording and a real metric value.
 */
export const getNumberOfFixations = (
  engine: DataEngine,
  stimulusId: number,
  participantId: number
): number => {
  const reader = engine.getReader()
  if (!reader) throw new Error('Binary reader not available')
  const { startIndex, endIndex } = reader.getFixationRange(stimulusId, participantId)
  return endIndex - startIndex
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
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const numParticipants = meta.participants.data.length
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

  const rawIds = reader.getRawAois(absoluteIndex)

  const uniqueAois = new Set(
    rawIds.map(rawId => engine.getAoiMapping(stimulusId, rawId))
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

