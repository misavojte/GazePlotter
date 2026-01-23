import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'

/**
 * Interface representing an Transition Matrix with labels
 */
export interface TransitionMatrixData {
  matrix: number[][]
  aoiLabels: string[]
  aoiList: ExtendedInterpretedDataType[]
}

export interface TransitionMetrics {
  sumMatrix: number[][]
  totalTransitions: number
  dwellTimeMatrix: number[][] // [fromIdx][toIdx] = total dwell time
  dwellCountMatrix: number[][] // [fromIdx][toIdx] = count of transitions for averaging
}

export interface ParticipantTransitionMetrics {
  matrix: number[][]
  dwellTimeMatrix: number[][]
  dwellCountMatrix: number[][]
}
