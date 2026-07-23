import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import { getCategoryRaw } from '../utils/interpreters'

export const getAllCategories = (engine: DataEngine): ExtendedInterpretedDataType[] => {
  const meta = engine.metadata
  if (!meta) return []
  return meta.categories.data.map((_, index) => getCategoryRaw(index, meta))
}
