import {
  type DataType,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import type { BinaryBufferReader } from '$lib/data/binary'
import type { DataEngine } from '../DataEngine.svelte'
import { getAoiRaw } from '../utils/interpreters'

/**
 * Displayed-AOI list cache.
 *
 * Keyed by the underlying `BinaryBufferReader`: a fresh reader on every
 * `DataEngine.loadDataset` makes the prior bucket unreachable, so the
 * WeakMap GC's it for free. The string key folds in `stimulusId` and
 * `AoiGroupReader.version` (bumps on every `updateMap()` call), so AOI
 * visibility toggles, renames, and grouping changes invalidate
 * automatically without explicit plumbing.
 *
 * Mirrors the metric cache strategy in `$lib/metrics/core/runtime.ts`.
 */
const _aoisCache = new WeakMap<
  BinaryBufferReader,
  Map<string, readonly ExtendedInterpretedDataType[]>
>()

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
): readonly ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const reader = engine.getReader()
  // Display-side cache: key on appearanceVersion so color / displayed-name
  // edits refresh getAois even when the structural version doesn't change.
  const appearance = engine.getAoiGroupReader?.()?.appearanceVersion ?? 0
  const key = `${stimulusId}|a${appearance}`

  if (reader) {
    const hit = _aoisCache.get(reader)?.get(key)
    if (hit) return hit
  }

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

  const list = Object.freeze(
    uniqueMappedIds.map(id => getAoiRaw(stimulusId, id, meta))
  ) as readonly ExtendedInterpretedDataType[]

  if (reader) {
    let bucket = _aoisCache.get(reader)
    if (!bucket) {
      bucket = new Map()
      _aoisCache.set(reader, bucket)
    }
    bucket.set(key, list)
  }

  return list
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
