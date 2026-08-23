/**
 * Cross-plot value-axis synchronization for distribution plots.
 *
 * Two plots of the SAME type that share the same selected metric instance AND
 * the same grid footprint (w, h) share their value-axis maximum, so their
 * figures stay directly comparable across a row/grid of same-shape plots. The
 * plot type is part of the key: an AOI Comparison and an Eye-movement
 * Comparison count different things per slot, so they never pool axes even if
 * they somehow named the same instance.
 *
 * Each plot registers its own raw dataMax; when deriving the timeline in "auto"
 * mode, a plot substitutes the largest registered dataMax across the matching
 * group. A user-set `scaleRange` always wins over sync — sync only affects the
 * auto-mode fallback, and export never syncs at all.
 */

import { PlotSyncRegistry } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { sessionScoped } from '$lib/session/context'

interface SyncEntry {
  plotType: string
  metricInstanceId: string
  w: number
  h: number
  dataMax: number
}

export class DistributionValueAxisSync extends PlotSyncRegistry<SyncEntry> {
  /** Largest dataMax across all plots sharing (plotType, metric, w, h). */
  getSyncedMax(
    plotType: string,
    metricInstanceId: string,
    w: number,
    h: number
  ): number {
    return this.maxWhere(
      e =>
        e.plotType === plotType &&
        e.metricInstanceId === metricInstanceId &&
        e.w === w &&
        e.h === h
    )
  }
}

/** This session's registry; resolve at component init. */
export const distributionValueAxisSync = sessionScoped(
  () => new DistributionValueAxisSync()
)
