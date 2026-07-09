import type { EngineMetadata, ExtendedInterpretedDataType } from '$lib/data/types'
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
