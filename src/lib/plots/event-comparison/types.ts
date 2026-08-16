import type { StatisticalOverlayType } from '$lib/plots/shared/distribution'

export type EventComparisonSettings = {
  stimulusId: number
  groupId: number
  /** Per-plot event SELECTION id; unset/0 = all channels. */
  eventSelectionId?: number
  /**
   * Workspace-level metric library reference — the same single-select wire
   * format every metric plot uses (length 0 = none, length 1 = the chosen
   * instance). The contract narrows the library to event-vector recipes;
   * the plot renders the instance's whole per-channel vector directly.
   */
  metricInstanceIds: string[]
  orientation: 'vertical' | 'horizontal'
  orderBy: 'value' | 'channel'
  orderDirection: 'asc' | 'desc'
  scaleRange: [number, number]
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
}
