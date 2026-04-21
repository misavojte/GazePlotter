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

interface SyncEntry {
  metricInstanceId: string
  w: number
  h: number
  dataMax: number
}

class BarPlotValueAxisSync {
  #entries: Record<number, SyncEntry> = $state({})

  /** Register or update a plot's contribution to its matching sync group. */
  setEntry(plotId: number, entry: SyncEntry): void {
    this.#entries[plotId] = entry
  }

  /** Remove a plot from the registry (call on component unmount). */
  clearEntry(plotId: number): void {
    delete this.#entries[plotId]
  }

  /**
   * Returns the largest dataMax across all plots that share (metric, w, h).
   * Returns 0 when no plot matches — callers should fall back to their own
   * data max in that case.
   */
  getSyncedMax(metricInstanceId: string, w: number, h: number): number {
    let max = 0
    for (const id in this.#entries) {
      const e = this.#entries[id]
      if (
        e.metricInstanceId === metricInstanceId &&
        e.w === w &&
        e.h === h &&
        e.dataMax > max
      ) {
        max = e.dataMax
      }
    }
    return max
  }
}

export const barPlotValueAxisSync = new BarPlotValueAxisSync()
