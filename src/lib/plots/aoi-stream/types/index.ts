import type { AdaptiveTimeline } from '$lib/plots/shared/class/AdaptiveTimeline'

export interface AoiStreamPlotSeries {
  id: number
  label: string
  color: string
  values: Float32Array
}

export interface AoiStreamPlotResult {
  upperSeries: AoiStreamPlotSeries[]
  lowerSeries: AoiStreamPlotSeries[]
  timeline: AdaptiveTimeline
  binCount: number
  binSize: number
  maxTime: number
  upperParticipants: number
  lowerParticipants: number
  upperMaxTotal: number
  lowerMaxTotal: number
}
