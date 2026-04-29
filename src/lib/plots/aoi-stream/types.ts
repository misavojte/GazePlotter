import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type AoiStreamPlotSettings = {
  stimulusId: number
  groupId: number
  /**
   * Slug of the windowed × aoi-vector MetricInstance this plot renders.
   * The instance's WindowedProjection owns the bin size — there is no
   * separate `binSize` setting; window configuration lives on the metric.
   */
  metricInstanceId: string | null
  highlights?: string[]
  absoluteStimuliLimits: [number, number][]
  alignment?: 'stream' | 'distribution' | 'ridgeline' | 'heatmap'
  colorScale?: string[]
  ridgelineScale?: number
  timelineStart?: number
  timelineEnd?: number
}

export type AoiStreamPlotItem = PlotItemContract<
  'aoiStreamPlot',
  AoiStreamPlotSettings
>

export interface AoiStreamPlotSeries {
  id: number
  label: string
  color: string
  values: Float32Array
}

export interface AoiStreamPlotResult {
  series: AoiStreamPlotSeries[]
  timeline: AdaptiveTimeline
  /** Number of windows produced by the metric — matches `series[0].values.length`. */
  binCount: number
  /**
   * Single-window length (ms). For non-overlapping windows this equals the
   * visual bin width; for sliding windows (`stepSize < windowSize`) the
   * window covers a *wider* time span than the spacing between adjacent
   * window centres — interpret bar/cell positions as window centres, not
   * disjoint slices.
   */
  windowSize: number
  /**
   * Distance between adjacent window starts (ms). Equals `windowSize` for
   * non-overlapping windows; smaller for sliding. Used by the figure for
   * tooltip time math (`binStartTime = timelineMin + binIndex × stepSize`)
   * and by the layout for x-position computation (window centre lands at
   * `binIndex × stepSize + windowSize / 2`).
   */
  stepSize: number
  maxTime: number
  participants: number
  /**
   * Largest stacked sum across all bins (sum over series per bin, then max
   * across bins). Drives stream/distribution y-axis range. In the metric's
   * native unit.
   */
  maxTotal: number
  /**
   * Largest single-cell value across all bins and series. Drives the
   * heatmap gradient range. In the metric's native unit.
   */
  maxValue: number
  /**
   * Y-axis / heatmap-legend label, formatted as `"<metric label> [<unit>]"`.
   * Values shown on the axis are in the metric's native unit (ms, count, %)
   * — there's no implicit normalisation, so picking a different metric in
   * the pane settings switches both the values and the unit.
   */
  yAxisLabel: string
  /**
   * Standardised windowing descriptor — `"500 ms window"` (non-overlapping)
   * or `"1000 ms window / 100 ms step"` (sliding). Built via the shared
   * `windowLabel(window, windowUnit)` helper so every plot surfaces the
   * same phrasing regardless of metric.
   */
  windowLabel: string
}
