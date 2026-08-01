import type { StatisticalOverlayType } from '$lib/plots/bar/types'

/** Which per-type metric the bars show. */
export type EyeMovementMetric =
  | 'count'
  | 'meanDuration'
  | 'totalTime'
  | 'timeShare'

export type EyeMovementComparisonSettings = {
  stimulusId: number
  groupId: number
  /** Per-plot eye-movement-type SELECTION id; unset/0 = all types. */
  categorySelectionId?: number
  metric: EyeMovementMetric
  barPlottingType: 'vertical' | 'horizontal'
  orderBy: 'value' | 'type'
  orderDirection: 'asc' | 'desc'
  scaleRange: [number, number]
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
}
