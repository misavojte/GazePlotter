import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type EvolvingMetricsSettings = {
  stimulusId: number
  groupId: number
  stepSize: number
  /** SW multiplier: 0 = tumbling, 1 = 3 bins, 2 = 5 bins, etc. */
  windowMultiplier: number
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
  windowMultiplier: number
  /** Effective window size in ms (derived from multiplier) */
  windowMs: number
  maxTime: number
  valueMin: number
  valueMax: number
}
