/**
 * Cross-plot value-axis synchronization for bar plots.
 *
 * Two bar plots that share the same selected metric instance AND the same
 * grid footprint (w, h) will share their value-axis maximum so the beeswarms
 * and overlays stay directly comparable across a row/grid of same-shape plots.
 *
 * Each plot registers its own raw dataMax. When deriving the timeline in
 * "auto" mode, a plot substitutes its own dataMax with the largest registered
 * dataMax across the matching group. A user-set scaleRange on the plot menu
 * always wins over sync — sync only affects the auto-mode fallback.
 */

import { PlotSyncRegistry } from '$lib/plots/shared/PlotSyncRegistry.svelte'

interface SyncEntry {
  metricInstanceId: string
  w: number
  h: number
  dataMax: number
}

class BarPlotValueAxisSync extends PlotSyncRegistry<SyncEntry> {
  /** Largest dataMax across all bar plots sharing (metric, w, h). */
  getSyncedMax(metricInstanceId: string, w: number, h: number): number {
    return this.maxWhere(
      e => e.metricInstanceId === metricInstanceId && e.w === w && e.h === h,
    )
  }
}

export const barPlotValueAxisSync = new BarPlotValueAxisSync()
