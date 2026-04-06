import type { AdaptiveTimeline } from '$lib/plots/shared'
import type {
  BaseInterpretedDataType,
  SegmentInterpretedDataType,
} from '$lib/data/types'
import type { PlotItemContract } from '$lib/plots/definePlot'

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
}

export type BarPlotItem = PlotItemContract<'barPlot', BarPlotSettings>

export interface BarPlotDataItem {
  value: number
  label: string
  color: string
}

export interface BarPlotResult {
  data: BarPlotDataItem[]
  timeline: AdaptiveTimeline
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
}
