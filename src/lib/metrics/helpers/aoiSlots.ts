import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'

export interface AoiSlots {
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
  aois: ExtendedInterpretedDataType[]
): AoiSlots | null {
  const reader = engine.getReader()
  if (!reader) return null
  const aoiCount = aois.length
  const noAoiSlot = aoiCount
  const anyFixationSlot = aoiCount + 1
  const totalSlots = aoiCount + 2
  const hiddenAois = engine.metadata?.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set<number>(hiddenAois) : null
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) {
    aoiLookup.set(aois[i].id, i)
  }
  return { reader, totalSlots, noAoiSlot, anyFixationSlot, hiddenAoisSet, aoiLookup }
}
