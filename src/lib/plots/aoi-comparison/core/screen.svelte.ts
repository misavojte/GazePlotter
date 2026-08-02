import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { createAdaptiveTimeline } from '$lib/plots/shared'
import { aoiComparisonValueAxisSync } from './sync.svelte'
import type { AoiComparisonViewMeta } from './view'
import type { AoiComparisonSettings } from '../types'

/**
 * Screen recipe: value-axis sync. Registers this plot's data max under its
 * metric instance (same metric + same grid size share one value axis) and
 * overlays a synced timeline on the figure when a sibling's max is larger.
 * Export renders the raw (unsynced) view — export never syncs.
 */
export const aoiComparisonScreen: PlotScreenFactory<AoiComparisonSettings> = ctx => {
  const hasCustomScale = () => {
    const s = ctx.item.settings
    return (
      s.scaleRange !== undefined &&
      (s.scaleRange[0] !== 0 || s.scaleRange[1] !== 0)
    )
  }

  usePlotSync(
    aoiComparisonValueAxisSync,
    () => ctx.item.id,
    () => {
      const meta = (ctx.view()?.meta ?? null) as AoiComparisonViewMeta | null
      if (!meta || meta.syncKey === null || hasCustomScale()) return null
      return {
        metricInstanceId: meta.syncKey,
        w: ctx.item.w,
        h: ctx.item.h,
        dataMax: meta.dataMax,
      }
    }
  )

  return {
    props: view => {
      const meta = view.meta as AoiComparisonViewMeta
      if (hasCustomScale() || meta.syncKey === null) return {}
      const syncedMax = aoiComparisonValueAxisSync.getSyncedMax(
        meta.syncKey,
        ctx.item.w,
        ctx.item.h
      )
      if (syncedMax <= meta.dataMax) return {}
      const raw = view.props.timeline as { minValue: number }
      return { timeline: createAdaptiveTimeline(raw.minValue, syncedMax, 6) }
    },
  }
}
