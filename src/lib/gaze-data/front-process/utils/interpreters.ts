import type {
  DataType,
  ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'

export const DEFAULT_COLORS = [
  '#66c5cc',
  '#f6cf71',
  '#f89c74',
  '#dcb0f2',
  '#87c55f',
]

export const getDefaultColor = (index: number): string =>
  DEFAULT_COLORS[index % DEFAULT_COLORS.length]

export const getAoiRaw = (
  stimulusId: number,
  aoiId: number,
  metadata: Omit<DataType, 'segments'>
): ExtendedInterpretedDataType => {
  const aoiArray = metadata.aois.data[stimulusId]?.[aoiId]
  if (!aoiArray) {
    throw new Error(
      `AOI with id ${aoiId} does not exist in stimulus with id ${stimulusId}`
    )
  }

  const originalName = aoiArray[0]
  return {
    id: aoiId,
    originalName,
    displayedName: aoiArray[1] ?? originalName,
    color: aoiArray[2] ?? getDefaultColor(aoiId),
  }
}

export const getCategoryRaw = (
  categoryId: number,
  metadata: Omit<DataType, 'segments'>
): ExtendedInterpretedDataType => {
  const categoryArray = metadata.categories.data[categoryId]
  if (!categoryArray) {
    throw new Error(`Category with id ${categoryId} does not exist`)
  }

  const originalName = categoryArray[0]
  return {
    id: categoryId,
    originalName,
    displayedName: categoryArray[1] ?? originalName,
    color: categoryArray[2] ?? '#626262',
  }
}
