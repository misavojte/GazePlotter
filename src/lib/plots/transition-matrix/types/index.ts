import type { ExtendedInterpretedDataType } from '$lib/type/Data'

/**
 * Interface representing an Transition Matrix with labels
 */
export interface TransitionMatrixData {
  matrix: number[][]
  aoiLabels: string[]
  aoiList: ExtendedInterpretedDataType[]
}
