/**
 * Cross-plot color-scale sync for fixation heatmaps: auto-scaled maps of the same
 * measure (accumulate, normalization, R, color scale) and grid footprint share
 * the largest scale top, so their colors compare. A set Scale max opts a plot out;
 * export never syncs.
 */
import { PlotSyncRegistry } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { sessionScoped } from '$lib/session/context'

interface SyncEntry {
  groupKey: string
  w: number
  h: number
  dataMax: number
}

export class FixationHeatmapColorSync extends PlotSyncRegistry<SyncEntry> {
  /** Largest scale top across plots sharing (groupKey, w, h). */
  getSyncedMax(groupKey: string, w: number, h: number): number {
    return this.maxWhere(e => e.groupKey === groupKey && e.w === w && e.h === h)
  }
}

/** This session's registry; resolve at component init. */
export const fixationHeatmapColorSync = sessionScoped(() => new FixationHeatmapColorSync())
