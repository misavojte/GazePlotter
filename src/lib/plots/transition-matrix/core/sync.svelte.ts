/**
 * Cross-plot color-scale synchronization for transition-matrix plots.
 *
 * Plots that share (aggregationMethod, colorScale, w, h) share their color
 * axis maximum so same-shape matrices can be compared at a glance. A plot
 * participates only while its colorValueRange is left at the default
 * [0, 0] — the moment the user sets an explicit min or max, the plot opts
 * out (does not contribute, does not read).
 */

interface SyncEntry {
  /** Composite key identifying matrices that are comparable (metric + display + step). */
  groupKey: string
  /** Stringified colorScale — compared byte-for-byte across plots. */
  colorScaleKey: string
  w: number
  h: number
  dataMax: number
}

class TransitionMatrixColorSync {
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
   * Largest dataMax across all plots sharing (groupKey, colorScaleKey, w, h).
   * Returns 0 when nothing matches.
   */
  getSyncedMax(
    groupKey: string,
    colorScaleKey: string,
    w: number,
    h: number
  ): number {
    let max = 0
    for (const id in this.#entries) {
      const e = this.#entries[id]
      if (
        e.groupKey === groupKey &&
        e.colorScaleKey === colorScaleKey &&
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

export const transitionMatrixColorSync = new TransitionMatrixColorSync()

/** Turn a color-scale array into a stable key for sync comparison. */
export function colorScaleToKey(colorScale: string[]): string {
  return colorScale.join('|')
}
