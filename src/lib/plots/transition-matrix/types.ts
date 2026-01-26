import type { ExtendedInterpretedDataType } from '$lib/data/types'

/**
 * Interface representing an Transition Matrix with labels
 */
export interface TransitionMatrixData {
  /** Flat row-major array: [row * size + col] */
  matrix: Float64Array | number[]
  aoiLabels: string[]
  aoiList: ExtendedInterpretedDataType[]
}

export interface TransitionMetrics {
  /** Flat row-major array: [row * size + col] */
  sumMatrix: Float64Array
  /** Flat row-major array: [row * size + col] */
  dwellTimeMatrix: Float64Array
  /** Flat row-major array: [row * size + col] */
  dwellCountMatrix: Int32Array
  totalTransitions: number
}
