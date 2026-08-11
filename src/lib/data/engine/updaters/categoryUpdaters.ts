import {
  FIXATION_CATEGORY_ID,
  reservedFixationName,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'

export const updateCategories = (
  engine: DataEngine,
  categories: ExtendedInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  // Update categories data. Original names are immutable by definition (the
  // vendor names), so every row keeps its previous one. Displayed names are
  // locked for the fixation row (id 0 backs every AOI metric and the scarf's
  // AOI layer) and for collisions with its reserved name — the modal blocks
  // both, this guard keeps the invariant total.
  const catData = meta.categories.data
  const reserved = reservedFixationName(catData)
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    if (c.id < 0 || c.id >= catData.length) continue
    const prev = catData[c.id]
    // An empty reserved name locks nothing beyond row 0: the displayed-name
    // fold keeps empty names standalone, so clearing a name is no collision.
    const nameLocked =
      c.id === FIXATION_CATEGORY_ID ||
      (reserved !== '' && c.displayedName.trim() === reserved)
    catData[c.id] = [
      prev?.[0] ?? c.originalName,
      nameLocked ? (prev?.[1] ?? c.originalName) : c.displayedName,
      c.color,
    ]
  }

  // Update order vector
  meta.categories.orderVector = categories.map(c => c.id)
}
