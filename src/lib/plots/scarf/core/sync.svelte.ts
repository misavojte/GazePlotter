/**
 * Cross-plot timeline-axis synchronization for scarf plots.
 *
 * Scarf plots that share the same timeline mode ('absolute' | 'ordinal')
 * and the same grid footprint (w, h) share their timeline maximum so
 * same-shape scarfs can be directly compared side by side. 'relative' mode
 * is a fixed 0–100 scale and therefore never needs sync — participating
 * plots are only those in 'absolute' or 'ordinal' modes.
 *
 * A plot opts out of the group the moment any range is customized:
 * - global `timelineStart` / `timelineEnd` for absolute
 * - global `ordinalStart` / `ordinalEnd` for ordinal
 * - legacy per-stimulus `absoluteStimuliLimits` / `ordinalStimuliLimits`
 * Opted-out plots neither contribute to nor read from the registry.
 */

export type ScarfSyncTimelineMode = 'absolute' | 'ordinal'

interface SyncEntry {
  timeline: ScarfSyncTimelineMode
  w: number
  h: number
  dataMax: number
}

class ScarfTimelineSync {
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
   * Largest dataMax across all plots sharing (timeline, w, h). Returns 0
   * when nothing matches — callers fall back to their own data max.
   */
  getSyncedMax(
    timeline: ScarfSyncTimelineMode,
    w: number,
    h: number
  ): number {
    let max = 0
    for (const id in this.#entries) {
      const e = this.#entries[id]
      if (
        e.timeline === timeline &&
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

export const scarfTimelineSync = new ScarfTimelineSync()
