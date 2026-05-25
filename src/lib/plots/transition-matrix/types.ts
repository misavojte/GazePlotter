import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type TransitionMatrixPlotSettings = {
  stimulusId: number
  groupId: number
  /**
   * Slug(s) of the aoi-pair-matrix MetricInstance(s) this plot renders.
   * Stored as an array for uniformity with multi-select plots; the contract
   * is single-select so length is 0 (none) or 1 (selected). Presentation
   * transforms (probability, relative frequency, mean dwell) live on the
   * metric — the plot just renders whatever matrix the metric produces.
   */
  metricInstanceIds: string[]
  timelineStart?: number
  timelineEnd?: number
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
  aoiList: readonly ExtendedInterpretedDataType[]
  /** True when the plot's `metricInstanceIds[0]` points to a missing instance. */
  noMetric?: boolean
}
