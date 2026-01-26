import type { AdaptiveTimeline } from '$lib/plots/shared'
import type {
  BaseInterpretedDataType,
  SegmentInterpretedDataType,
} from '$lib/data/types'
import type { BarPlotAggregationMethodId } from './const'

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
