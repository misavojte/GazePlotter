import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type AoiStreamPlotSettings = {
  stimulusId: number
  groupId: number
  binSize: number
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
  binCount: number
  binSize: number
  maxTime: number
  participants: number
  maxTotal: number
}
