import type { AdaptiveTimeline } from '$lib/plots/shared/class'
import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType'

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
