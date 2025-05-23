import type { AdaptiveTimeline } from '$lib/plots/shared/class'
import type {
  BaseInterpretedDataType,
  SegmentInterpretedDataType,
} from '$lib/gaze-data/shared/types'

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
