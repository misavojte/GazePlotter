import type { AdaptiveTimeline } from '$lib/plots/shared'

export interface AoiStreamPlotSeries {
  id: number
  label: string
  color: string
  values: Float32Array
}

export interface AoiStreamPlotResult {
  series: AoiStreamPlotSeries[]
  timeline: AdaptiveTimeline
  binCount: number
  binSize: number
  maxTime: number
  participants: number
  maxTotal: number
}
