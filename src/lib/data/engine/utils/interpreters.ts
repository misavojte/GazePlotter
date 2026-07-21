import type {
  BaseInterpretedDataType,
  EngineMetadata,
  ExtendedInterpretedDataType,
} from '$lib/data/types'
import { DEFAULT_AOI_COLORS, DEFAULT_CATEGORY_COLORS } from '$lib/color/palettes'

export const getDefaultColor = (index: number): string =>
  DEFAULT_AOI_COLORS[index % DEFAULT_AOI_COLORS.length]

export const getDefaultCategoryColor = (index: number): string => {
  const palIndex = index > 0 ? index - 1 : 0
  return DEFAULT_CATEGORY_COLORS[palIndex % DEFAULT_CATEGORY_COLORS.length]
}

/** Event channels have no palette; a neutral gray is the uniform fallback. */
export const getDefaultEventChannelColor = (): string => '#888888'

/**
 * Null-tolerant metadata tuple → entity decode; THE shared displayed-name
 * rule: `row[1] ?? row[0]`, nullish only — an explicitly cleared displayed
 * name stays '' rather than falling back to the original (the scarf legend
 * and every exporter read it the same way). Only the color default differs
 * per entity type, so the caller supplies it.
 */
export const interpretRow = (
  row: readonly (string | null)[] | null | undefined,
  id: number,
  defaultColor: (id: number) => string
): ExtendedInterpretedDataType => {
  const originalName = row?.[0] ?? ''
  return {
    id,
    originalName,
    displayedName: row?.[1] ?? originalName,
    color: row?.[2] ?? defaultColor(id),
  }
}

/**
 * Base (color-free) `[originalName, displayedName]` tuples → entities in index
 * order — the participant / stimulus reverse decode. (Keeps the raw `row[1]`
 * displayed name, not `interpretRow`'s nullish fallback: those axes always
 * carry both fields, and the reverse must reproduce the forward exactly.)
 */
export const interpretBaseRows = (
  rows: readonly (readonly string[])[]
): BaseInterpretedDataType[] =>
  rows.map(([originalName, displayedName], id) => ({
    id,
    originalName,
    displayedName,
  }))

/**
 * Ordered {@link interpretRow} decode: walk `order` (or 0..n−1 when empty)
 * through the row list; order ids with no matching row are SKIPPED — a stale
 * order vector yields fewer entities, never a ghost `{'', ''}` one. THE single
 * ordered-decode policy, shared by the selector side (getEventChannels) and
 * the command reverses (event channels, eye-movement types).
 */
export const interpretOrdered = (
  defs: readonly (readonly (string | null)[] | null | undefined)[],
  order: readonly number[],
  defaultColor: (id: number) => string
): ExtendedInterpretedDataType[] => {
  const ids =
    order.length > 0 ? order : Array.from({ length: defs.length }, (_, i) => i)
  const out: ExtendedInterpretedDataType[] = []
  for (const id of ids) {
    const row = defs[id]
    if (row) out.push(interpretRow(row, id, defaultColor))
  }
  return out
}

export const getAoiRaw = (
  stimulusId: number,
  aoiId: number,
  metadata: EngineMetadata
): ExtendedInterpretedDataType => {
  const aoiArray = metadata.aois.data[stimulusId]?.[aoiId]
  if (!aoiArray) {
    throw new Error(
      `AOI with id ${aoiId} does not exist in stimulus with id ${stimulusId}`
    )
  }
  return interpretRow(aoiArray, aoiId, getDefaultColor)
}

export const getCategoryRaw = (
  categoryId: number,
  metadata: EngineMetadata
): ExtendedInterpretedDataType => {
  const categoryArray = metadata.categories.data[categoryId]
  if (!categoryArray) {
    throw new Error(`Category with id ${categoryId} does not exist`)
  }
  return interpretRow(categoryArray, categoryId, getDefaultCategoryColor)
}
