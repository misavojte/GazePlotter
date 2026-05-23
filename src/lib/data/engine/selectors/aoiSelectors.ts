import {
  type DataType,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'
import { getAoiRaw } from '../utils/interpreters'

const getAoiOrderVectorFromData = (
  stimulusId: number,
  metadata: Omit<DataType, 'segments'>
): number[] => {
  const stimulusAois = metadata.aois.data[stimulusId]
  if (!stimulusAois)
    throw new Error(`AOI data for stimulus ${stimulusId} not found`)

  const order = metadata.aois.orderVector?.[stimulusId]
  if (order == null || order.length === 0) {
    return Array.from({ length: stimulusAois.length }, (_, i) => i)
  }
  return order
}

/**
 * Get all AOIs for a stimulus from a data snapshot
 */
export const getAoisRawFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): ExtendedInterpretedDataType[] => {
  return getAoiOrderVectorFromData(stimulusId, dataSnapshot).map(id =>
    getAoiRaw(stimulusId, id, dataSnapshot)
  )
}

export const getAoiOrderVector = (
  engine: DataEngine,
  stimulusId: number
): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return getAoiOrderVectorFromData(stimulusId, meta)
}

export const getHiddenAois = (
  engine: DataEngine,
  stimulusId: number
): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.aois.hiddenAois?.[stimulusId] ?? []
}

export const getAllAois = (
  engine: DataEngine,
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const ids = getAoiOrderVector(engine, stimulusId)
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  return ids.map(id => getAoiRaw(stimulusId, id, meta))
}

export const getAois = (
  engine: DataEngine,
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const ids = getAoiOrderVectorFromData(stimulusId, meta)
  const hidden = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const uniqueMappedIds = Array.from(
    new Set(
      ids
        .filter(id => !hiddenSet?.has(id))
        .map(id => engine.getAoiMapping(stimulusId, id))
    )
  )

  return uniqueMappedIds.map(id => getAoiRaw(stimulusId, id, meta))
}

export const getAoi = (
  engine: DataEngine,
  stimulusId: number,
  aoiId: number
): ExtendedInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine not initialized')
  const mappedAoiId = engine.getAoiMapping(stimulusId, aoiId)
  return getAoiRaw(stimulusId, mappedAoiId, meta)
}
