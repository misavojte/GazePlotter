import {
  type DataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'
import { getAoiRaw } from '../utils/interpreters'

const getAoiOrderVectorFromData = (
  stimulusId: number,
  metadata: Omit<DataType, 'segments'>
): number[] => {
  const stimulusAois = metadata.aois.data[stimulusId]
  if (!stimulusAois)
    throw new Error(`AOI data for stimulus ${stimulusId} not found`)

  const order = metadata.aois.orderVector?.[stimulusId]
  if (order == null) {
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
  const ids = getAoiOrderVectorFromData(stimulusId, dataSnapshot)
  const result = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    result[i] = getAoiRaw(stimulusId, ids[i], dataSnapshot)
  }
  return result
}

export const getAoiOrderVector = (stimulusId: number): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return getAoiOrderVectorFromData(stimulusId, meta)
}

export const getHiddenAois = (stimulusId: number): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.aois.hiddenAois?.[stimulusId] ?? []
}

export const getAllAois = (
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const ids = getAoiOrderVector(stimulusId)
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const result = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    result[i] = getAoiRaw(stimulusId, ids[i], meta)
  }
  return result
}

export const getAois = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const ids = getAoiOrderVectorFromData(stimulusId, meta)
  const hidden = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const uniqueMappedIds = new Set<number>()
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (hiddenSet?.has(id)) continue
    uniqueMappedIds.add(engine.getAoiMapping(stimulusId, id))
  }

  const result: ExtendedInterpretedDataType[] = []
  for (const id of uniqueMappedIds) {
    result.push(getAoiRaw(stimulusId, id, meta))
  }
  return result
}

export const getAoi = (
  stimulusId: number,
  aoiId: number
): ExtendedInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine not initialized')
  const mappedAoiId = engine.getAoiMapping(stimulusId, aoiId)
  return getAoiRaw(stimulusId, mappedAoiId, meta)
}
