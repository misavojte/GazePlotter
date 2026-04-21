import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type EvolvingMetricsSettings = {
  stimulusId: number
  groupId: number
  selectedMetricId: string | null
  presentation?: 'heatmap' | 'overlay'
  colorScale?: string[]
  timelineStart?: number
  timelineEnd?: number
}

export type EvolvingMetricsItem = PlotItemContract<
  'evolvingMetrics',
  EvolvingMetricsSettings
>

export interface EvolvingMetricsParticipant {
  id: number
  label: string
  values: Float32Array
}

export interface EvolvingMetricsResult {
  participants: EvolvingMetricsParticipant[]
  timeline: AdaptiveTimeline
  binCount: number
  stepSize: number
  xAxisLabel: string
  yAxisLabel: string
  maxTime: number
  valueMin: number
  valueMax: number
}
