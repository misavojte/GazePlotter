import {
  type NameSelection,
  type EngineMetadata,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import type { BinaryBufferReader } from '$lib/data/binary'
import type { DataEngine } from '../dataEngine.svelte'
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

/**
 * Selection-resolution memo, layered over `_aoisCache`.
 *
 * With a selection active, `getAois` runs once per (participant × metric
 * instance × window) via slot signatures in `$lib/metrics/core/runtime.ts` —
 * 10^4-10^5 calls per plot recompute — and the find/name-set/filter/token
 * work above the token cache dominated. Keyed purely on identities that
 * change exactly when their input changes: the frozen base array (rebuilt
 * whenever AOI visibility/names/merges/appearance change — see `baseKey`) and
 * the `selections` array (`DataEngine.setAoiSelections` replaces it wholesale
 * on every selection edit; selection objects are never mutated in place — the
 * AOI modal saves fresh objects). Both layers are WeakMaps, so stale entries
 * die with their keys.
 *
 * HONESTY: the memo only skips recomputation. A first resolution still routes
 * through the shared id-token entry in `_aoisCache`, so which array object a
 * selection resolves to — and thus metric-cache sharing between equal
 * selections — is unchanged.
 */
const _selectionMemo = new WeakMap<
  readonly ExtendedInterpretedDataType[],
  WeakMap<NameSelection[], Map<number, readonly ExtendedInterpretedDataType[]>>
>()

const getAoiOrderVectorFromData = (
  stimulusId: number,
  metadata: EngineMetadata
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

const getAoiOrderVector = (
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

/** All named AOI SELECTIONS (see {@link NameSelection}). */
export const getAoiSelections = (engine: DataEngine): NameSelection[] =>
  engine.metadata?.aois.selections ?? []

/**
 * Resolve a per-plot `aoiSelectionId` to the set of currently-visible LOGICAL
 * AOI ids to KEEP for `stimulusId` — the selection's members present among this
 * stimulus's post-merge, globally-visible AOIs (matched by displayed name).
 * Returns `null` whenever the selection applies NO narrowing — "All"/unset/
 * unknown selection, or a selection covering every visible AOI — meaning no
 * filtering (the plot shows every AOI, byte-identical to before this feature).
 * AOIs NOT in the returned set collapse to no-AOI in the compute-honest
 * mechanism.
 *
 * Thin view over {@link getAois}: base-vs-narrowed IDENTITY is the
 * no-narrowing signal (getAois returns the base list by reference for every
 * no-narrowing case), so the displayed-name matching lives in one place.
 */
export const resolveAoiSelectionVisibleIds = (
  engine: DataEngine,
  stimulusId: number,
  aoiSelectionId: number | undefined
): Set<number> | null => {
  const base = getAois(engine, stimulusId)
  const narrowed = getAois(engine, stimulusId, aoiSelectionId)
  if (narrowed === base) return null
  return new Set(narrowed.map(a => a.id))
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
  stimulusId: number,
  /**
   * Optional per-plot AOI SELECTION. When set to a real selection id, the
   * returned list is the base list narrowed to that selection's members (by
   * displayed name) — the reduced alphabet a compute-honest plot ranges over.
   * Unset / 0 / unknown / selection-covers-everything → the shared base list
   * BY REFERENCE (byte-identical to before this parameter existed).
   */
  aoiSelectionId?: number
): readonly ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const reader = engine.getReader()
  // Display-side cache: key on appearanceVersion so color / displayed-name
  // edits refresh getAois even when the structural version doesn't change.
  const appearance = engine.getAoiGroupReader?.()?.appearanceVersion ?? 0
  const baseKey = `${stimulusId}|a${appearance}`

  // The base list = all globally-visible logical AOIs — shared by every caller
  // regardless of selection, so its frozen identity is stable.
  let base = reader ? _aoisCache.get(reader)?.get(baseKey) : undefined
  if (!base) {
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

    base = Object.freeze(
      uniqueMappedIds.map(id => getAoiRaw(stimulusId, id, meta))
    ) as readonly ExtendedInterpretedDataType[]

    if (reader) {
      let bucket = _aoisCache.get(reader)
      if (!bucket) {
        bucket = new Map()
        _aoisCache.set(reader, bucket)
      }
      bucket.set(baseKey, base)
    }
  }

  // No per-plot selection → the base list, by reference.
  if (aoiSelectionId == null || aoiSelectionId <= 0) return base
  const selections = meta.aois.selections
  if (!selections || selections.length === 0) return base

  // Hot path: repeat calls resolve in ~two map lookups (see _selectionMemo).
  let byBase = _selectionMemo.get(base)
  const memoized = byBase?.get(selections)?.get(aoiSelectionId)
  if (memoized) return memoized

  let resolved: readonly ExtendedInterpretedDataType[]
  const selection = selections.find(s => s.id === aoiSelectionId)
  if (!selection) {
    // Unknown selection id → base (self-healing, byte-identical to unset).
    resolved = base
  } else {
    const names = new Set(selection.names)
    const filtered = base.filter(a => names.has(a.displayedName))
    if (filtered.length === base.length) {
      // Selection covers every currently-visible AOI → base (byte-identical, shared).
      resolved = base
    } else {
      // Cache the narrowed list under a token of the KEPT logical ids: it
      // self-invalidates when the selection definition or AOI names change, and two
      // selections resolving to the SAME visible set share one array (and thus one
      // buildAoiSlots + slot-signature entry — equal selections share the metric cache).
      const token = filtered.map(a => a.id).join('.')
      const selKey = `${baseKey}|s${token}`
      const shared = reader ? _aoisCache.get(reader)?.get(selKey) : undefined
      if (shared) {
        resolved = shared
      } else {
        resolved = Object.freeze(filtered) as readonly ExtendedInterpretedDataType[]
        if (reader) {
          let bucket = _aoisCache.get(reader)
          if (!bucket) {
            bucket = new Map()
            _aoisCache.set(reader, bucket)
          }
          bucket.set(selKey, resolved)
        }
      }
    }
  }

  if (!byBase) {
    byBase = new WeakMap()
    _selectionMemo.set(base, byBase)
  }
  let byId = byBase.get(selections)
  if (!byId) {
    byId = new Map()
    byBase.set(selections, byId)
  }
  byId.set(aoiSelectionId, resolved)
  return resolved
}
