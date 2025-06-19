import type { AdaptiveTimeline } from '$lib/plots/shared/class'
import type {
  BaseInterpretedDataType,
  SegmentInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import type { BarPlotAggregationMethodId } from '../const/aggregationMethods'

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
