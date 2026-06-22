/**
 * Cross-plot color-scale synchronization for transition-matrix plots.
 *
 * Plots that share (aggregationMethod, colorScale, w, h) share their color
 * axis maximum so same-shape matrices can be compared at a glance. A plot
 * participates only while its colorValueRange is left at the default
 * [0, 0] — the moment the user sets an explicit min or max, the plot opts
 * out (does not contribute, does not read).
 */

import { PlotSyncRegistry } from '$lib/plots/shared/PlotSyncRegistry.svelte'

interface SyncEntry {
  /** Composite key identifying matrices that are comparable (metric + display + step). */
  groupKey: string
  /** Stringified colorScale — compared byte-for-byte across plots. */
  colorScaleKey: string
  w: number
  h: number
  dataMax: number
}

class TransitionMatrixColorSync extends PlotSyncRegistry<SyncEntry> {
  /** Largest dataMax across plots sharing (groupKey, colorScaleKey, w, h). */
  getSyncedMax(
    groupKey: string,
    colorScaleKey: string,
    w: number,
    h: number,
  ): number {
    return this.maxWhere(
      e =>
        e.groupKey === groupKey &&
        e.colorScaleKey === colorScaleKey &&
        e.w === w &&
        e.h === h,
    )
  }
}

export const transitionMatrixColorSync = new TransitionMatrixColorSync()

/** Turn a color-scale array into a stable key for sync comparison. */
export function colorScaleToKey(colorScale: string[]): string {
  return colorScale.join('|')
}
