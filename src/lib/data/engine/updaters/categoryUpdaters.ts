import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'

export const updateCategories = (
  engine: DataEngine,
  categories: ExtendedInterpretedDataType[],
  hiddenCategories?: number[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  // Update categories data
  const catData = meta.categories.data
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    if (c.id >= 0 && c.id < catData.length) {
      catData[c.id] = [c.originalName, c.displayedName, c.color]
    }
  }

  // Update order vector
  meta.categories.orderVector = categories.map(c => c.id)

  // Update hidden categories
  if (hiddenCategories !== undefined) {
    meta.categories.hiddenCategories = hiddenCategories
  }
}
