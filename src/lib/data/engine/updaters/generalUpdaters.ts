import { type DataType } from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'

/**
 * Loads a complete dataset into the engine.
 */
export const setData = (engine: DataEngine, newData: DataType): void => {
  engine.loadDataset(newData)
}

/**
 * Updates the visual treatment for sections with no AOI coverage.
 */
export const updateNoAoiTreatment = (
  engine: DataEngine,
  noAoiTreatment: {
  displayedName: string
  color: string
  }
): void => {
  engine.setNoAoiTreatment(noAoiTreatment)
}
