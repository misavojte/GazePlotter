import type { StatisticalOverlayType } from '$lib/plots/bar/types'

export type EyeMovementComparisonSettings = {
  stimulusId: number
  groupId: number
  /** Per-plot eye-movement-type SELECTION id; unset/0 = all types. */
  categorySelectionId?: number
  /**
   * Workspace-level metric library reference — the same single-select wire
   * format every metric plot uses (length 0 = none, length 1 = the chosen
   * instance). The contract narrows the library to category-vector recipes;
   * the plot renders the instance's whole per-type vector directly.
   */
  metricInstanceIds: string[]
  barPlottingType: 'vertical' | 'horizontal'
  orderBy: 'value' | 'type'
  orderDirection: 'asc' | 'desc'
  scaleRange: [number, number]
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
}
