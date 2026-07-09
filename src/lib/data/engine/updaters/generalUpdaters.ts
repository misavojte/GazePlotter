import type { DataEngine } from '../dataEngine.svelte'

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
