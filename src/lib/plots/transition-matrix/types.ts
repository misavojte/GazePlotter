import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type TransitionMatrixPlotSettings = {
  stimulusId: number
  groupId: number
  /**
   * Picked from the metric library; filtered to aoi-pair-matrix metrics.
   * Presentation transforms (probability, relative frequency, mean dwell) live on
   * the metric itself — the plot just renders whatever matrix the metric produces.
   */
  metricInstanceId: number | null
  stimuliColorValueRanges: [number, number][]
  belowMinColor: string
  aboveMaxColor: string
  showBelowMinLabels: boolean
  showAboveMaxLabels: boolean
  colorScale: string[]
}

export type TransitionMatrixPlotItem = PlotItemContract<
  'transitionMatrix',
  TransitionMatrixPlotSettings
>

export interface TransitionMatrixData {
  matrix: Float64Array | number[]
  aoiLabels: string[]
  aoiList: ExtendedInterpretedDataType[]
  /** True when the plot's `metricInstanceId` points to a missing instance. */
  noMetric?: boolean
}
