import type { AdaptiveTimeline } from '$lib/plots/shared'
import type {
  BaseInterpretedDataType,
  SegmentInterpretedDataType,
} from '$lib/data/types'
import type { PlotItemContract } from '$lib/plots/definePlot'

// --- Visualization overlay on top of beeswarm points ---

export type StatisticalOverlayType =
  | 'none'
  | 'meanCi95'
  | 'meanSd'
  | 'boxplot'

// --- Per-AOI statistics bundle ---

export interface AoiSummaryStatistics {
  mean: number
  median: number
  q1: number
  q3: number
  min: number
  max: number
  sd: number
  sem: number
  whiskerLow: number // max(min, Q1 - 1.5*IQR)
  whiskerHigh: number // min(max, Q3 + 1.5*IQR)
  count: number
  outliers: number[] // values beyond whiskers
}

export type BarPlotSettings = {
  stimulusId: number
  groupId: number
  barPlottingType: 'vertical' | 'horizontal'
  orderBy: 'value' | 'aoi'
  orderDirection: 'asc' | 'desc'
  aggregationMethod: string
  scaleRange: [number, number]
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
}

export type BarPlotItem = PlotItemContract<'barPlot', BarPlotSettings>

export interface BarPlotDataItem {
  value: number
  label: string
  color: string
  stats: AoiSummaryStatistics | null
  individualValues: number[] | null
  individualParticipantNames: string[] | null
}

export interface BarPlotResult {
  data: BarPlotDataItem[]
  timeline: AdaptiveTimeline
  /**
   * Raw maximum across individual values (and whiskers for the boxplot
   * overlay), before nice-rounding is applied to the timeline. Exposed so
   * cross-plot sync can compare apples to apples between plots.
   */
  dataMax: number
}

export interface ParticipantSegmentData {
  participant: BaseInterpretedDataType
  segments: SegmentInterpretedDataType[]
}

export interface ParticipantAggregationData {
  participant: BaseInterpretedDataType
  aois: {
    [key: string]: number
    NO_AOI: number
    ANY_OR_NO_AOI: number
  }
}

export type AggregationFunction = (
  stimulusId: string,
  participantIds: number[]
) => ParticipantAggregationData[]

export interface ParticipantBarMetrics {
  dwellTime: number[] // [aoi0, aoi1, ..., noAoi, anyFixation]
  ttff: number[] // [aoi0, aoi1, ..., noAoi, anyFixation] (-1 if not seen)
  fixationCount: number[] // [aoi0, aoi1, ..., noAoi, anyFixation]
  hitRatio: number[] // [aoi0, aoi1, ..., noAoi, anyFixation] (binary 0/1)
  entryCount: number[] // [aoi0, aoi1, ..., noAoi, anyFixation]
  dwellDurations: number[][] // [aoi0[], aoi1[], ..., noAoi[], anyFixation[]]
  firstFixationDuration: number[] // [aoi0, aoi1, ..., noAoi, anyFixation] (-1 if not seen)
  avgFixationDuration: number[][] // [aoi0[], aoi1[], ..., noAoi[], anyFixation[]]
  fixationAoiSequence: number[] // AOI index per fixation (unambiguous single-AOI hits only)
  fixationTimestamps: number[] // segment start time (ms), parallel to fixationAoiSequence
}
