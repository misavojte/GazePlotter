/**
 * Cross-plot sync registries for AOI Timeline plots — push-based, the same
 * `PlotSyncRegistry` pattern as scarf/bar/transition-matrix. These replace the
 * former grid-scanning modules (`sync/timeline.ts`, `sync/ridgeline.ts`),
 * which pulled sibling plots' settings out of `grid.items` and re-ran their
 * transforms on every evaluation.
 *
 * Timeline: plots with the same grid width (w) and a fully-auto timeline (no
 * `timelineEnd`, no per-stimulus limits) share their timeline maximum so
 * same-width plots are directly comparable. Customizing any range opts the
 * plot out — it neither contributes nor reads.
 *
 * Ridgeline: ridgeline plots with the same grid height (h), ridgeline scale
 * and series count share the most constraining `mTop` (data-scale factor) so
 * their strips render on one comparable data scale. `mTop` is registered from
 * the plot's OWN transform result, so there is no feedback loop — the synced
 * value affects strip rendering only, never the transform.
 */
import { PlotSyncRegistry } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { sessionScoped } from '$lib/session/context'

interface TimelineEntry {
  w: number
  dataMax: number
}

export class AoiStreamTimelineSync extends PlotSyncRegistry<TimelineEntry> {
  /** Largest data max across participating plots of the same width. */
  getSyncedMax(w: number): number {
    return this.maxWhere(e => e.w === w)
  }
}

/** This session's registry; resolve at component init. */
export const aoiStreamTimelineSync = sessionScoped(
  () => new AoiStreamTimelineSync()
)

interface RidgelineEntry {
  h: number
  scale: number
  seriesCount: number
  /** The plot's own mTop (`computeMTop(result, true)`). */
  dataMax: number
}

export class AoiStreamRidgelineSync extends PlotSyncRegistry<RidgelineEntry> {
  /** Most constraining mTop across ridgelines sharing (h, scale, seriesCount). */
  getSyncedMTop(h: number, scale: number, seriesCount: number): number {
    return this.maxWhere(
      e =>
        e.h === h &&
        Math.abs(e.scale - scale) < 1e-4 &&
        e.seriesCount === seriesCount
    )
  }
}

/** This session's registry; resolve at component init. */
export const aoiStreamRidgelineSync = sessionScoped(
  () => new AoiStreamRidgelineSync()
)
