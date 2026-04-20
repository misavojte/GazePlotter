import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import type { ExtendedInterpretedDataType } from '$lib/data/types'

export interface ResolvedAoiSlots {
  reader: NonNullable<ReturnType<DataEngine['getReader']>>
  totalSlots: number
  noAoiSlot: number
  anyFixationSlot: number
  hiddenAoisSet: Set<number> | null
  aoiLookup: Map<number, number>
}

export function buildAoiSlots(
  engine: DataEngine,
  stimulusId: number,
  aois?: ExtendedInterpretedDataType[]
): ResolvedAoiSlots | null {
  const reader = engine.getReader()
  if (!reader) return null
  const aoiList = aois ?? getAois(engine, stimulusId)
  const aoiCount = aoiList.length
  const noAoiSlot = aoiCount
  const anyFixationSlot = aoiCount + 1
  const totalSlots = aoiCount + 2
  const hiddenAois = engine.metadata?.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set<number>(hiddenAois) : null
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) aoiLookup.set(aoiList[i].id, i)
  return {
    reader,
    totalSlots,
    noAoiSlot,
    anyFixationSlot,
    hiddenAoisSet,
    aoiLookup,
  }
}
