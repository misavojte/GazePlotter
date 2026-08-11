import type { StatisticalOverlayType } from '$lib/plots/shared/distribution'

export type AoiComparisonSettings = {
  stimulusId: number
  groupId: number
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
  orientation: 'vertical' | 'horizontal'
  orderBy: 'value' | 'aoi'
  orderDirection: 'asc' | 'desc'
  /**
   * Workspace-level metric library reference, stored as an array even for
   * single-select plots so persistence is uniform with multi-select plots
   * like metric-correlation. Length 0 = no selection; length 1 = the chosen
   * instance id. The plot's contract (`multiSelect: false`) constrains the
   * UI to a single choice; the array shape is the canonical wire format.
   */
  metricInstanceIds: string[]
  scaleRange: [number, number]
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
  hideNoAoi?: boolean
}
