import { type DataType } from '$lib/data/types'
import { engine } from '../DataEngine.svelte'

/**
 * Loads a complete dataset into the engine.
 */
export const setData = (newData: DataType): void => {
  engine.loadDataset(newData)
}

/**
 * Updates the visual treatment for sections with no AOI coverage.
 */
export const updateNoAoiTreatment = (noAoiTreatment: {
  displayedName: string
  color: string
}): void => {
  engine.setNoAoiTreatment(noAoiTreatment)
}
