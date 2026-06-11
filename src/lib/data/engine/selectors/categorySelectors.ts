import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'
import { getCategoryRaw } from '../utils/interpreters'

export const getHiddenCategories = (engine: DataEngine): number[] => {
  const meta = engine.metadata
  if (!meta) return []
  return meta.categories.hiddenCategories ?? []
}

export const getAllCategories = (engine: DataEngine): ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) return []
  return meta.categories.data.map((_, index) => getCategoryRaw(index, meta))
}

export const getVisibleCategories = (engine: DataEngine): ExtendedInterpretedDataType[] => {
  const all = getAllCategories(engine)
  const hidden = new Set(getHiddenCategories(engine))
  return all.filter(c => !hidden.has(c.id))
}
