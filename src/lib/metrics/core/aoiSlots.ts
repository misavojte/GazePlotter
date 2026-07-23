import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois } from '$lib/data/engine'
import type { ExtendedInterpretedDataType } from '$lib/data/types'

/**
 * The scan-side superset of `AoiSlotInfo` (dsl.ts): the slot layout PLUS
 * everything a fixation scan needs to resolve raw AOI ids to slots. Results
 * and recipe contexts carry the plain `AoiSlotInfo`; scans carry this.
 */
export interface ResolvedAoiSlots {
  reader: NonNullable<ReturnType<DataEngine['getReader']>>
  totalSlots: number
  noAoiSlot: number
  anyFixationSlot: number
  aoiLookup: Map<number, number>
  /**
   * Raw AOI id → slot index, or -1 (unmapped / out of selection). Precomputed
   * so the per-fixation scan loops resolve a raw id with ONE typed-array read
   * instead of an engine mapping call + Map lookup.
   */
  rawToSlot: Int32Array
}

/**
 * Memoized on the frozen array `getAois` returns: that reference is stable
 * per (reader, stimulusId, appearanceVersion, aoiSelectionId) and changes on
 * every AOI edit or dataset reload — exactly the inputs slots derive from —
 * so the array identity IS the invalidation token. A
 * per-plot `aoiSelectionId` yields a distinct cached array (see getAois), so
 * plots with different selections get distinct slots automatically while plots
 * on the same visible set share one entry (no rebuild). Out-of-selection raw
 * AOIs miss `aoiLookup` below and land at rawToSlot -1 → no-AOI in the hot
 * scan — the compute-honest reduced alphabet, with zero hot-scan change.
 */
const _slotsCache = new WeakMap<
  readonly ExtendedInterpretedDataType[],
  ResolvedAoiSlots
>()

export function buildAoiSlots(
  engine: DataEngine,
  stimulusId: number,
  aoiSelectionId?: number
): ResolvedAoiSlots | null {
  const reader = engine.getReader()
  if (!reader) return null
  const aoiList = getAois(engine, stimulusId, aoiSelectionId)
  const hit = _slotsCache.get(aoiList)
  if (hit && hit.reader === reader) return hit

  const aoiCount = aoiList.length
  const noAoiSlot = aoiCount
  const anyFixationSlot = aoiCount + 1
  const totalSlots = aoiCount + 2
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) aoiLookup.set(aoiList[i].id, i)

  const rawCount = engine.metadata?.aois.data[stimulusId]?.length ?? 0
  const rawToSlot = new Int32Array(rawCount).fill(-1)
  for (let rawId = 0; rawId < rawCount; rawId++) {
    const slot = aoiLookup.get(engine.getAoiMapping(stimulusId, rawId))
    if (slot !== undefined) rawToSlot[rawId] = slot
  }

  const slots: ResolvedAoiSlots = {
    reader,
    totalSlots,
    noAoiSlot,
    anyFixationSlot,
    aoiLookup,
    rawToSlot,
  }
  _slotsCache.set(aoiList, slots)
  return slots
}
