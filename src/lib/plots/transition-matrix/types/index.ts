import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'

/**
 * Interface representing an Transition Matrix with labels
 */
export interface TransitionMatrixData {
  matrix: number[][]
  aoiLabels: string[]
  aoiList: ExtendedInterpretedDataType[]
}
