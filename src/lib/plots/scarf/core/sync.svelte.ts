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

import { PlotSyncRegistry } from '$lib/plots/shared/PlotSyncRegistry.svelte'

export type ScarfSyncTimelineMode = 'absolute' | 'ordinal'

interface SyncEntry {
  timeline: ScarfSyncTimelineMode
  w: number
  h: number
  dataMax: number
}

class ScarfTimelineSync extends PlotSyncRegistry<SyncEntry> {
  /** Largest dataMax across all plots sharing (timeline, w, h). */
  getSyncedMax(
    timeline: ScarfSyncTimelineMode,
    w: number,
    h: number,
  ): number {
    return this.maxWhere(
      e => e.timeline === timeline && e.w === w && e.h === h,
    )
  }
}

export const scarfTimelineSync = new ScarfTimelineSync()
