import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { transitionMatrixColorSync } from './sync.svelte'
import type { TransitionViewMeta } from './view'
import type { TransitionMatrixPlotSettings } from '../types'

/**
 * Screen recipe: color-axis sync. Matrices sharing (metric, color scale, grid
 * size) with a default color range share the largest data max so their color
 * scales are directly comparable. Export renders the raw (unsynced) view.
 */
export const transitionMatrixScreen: PlotScreenFactory<
  TransitionMatrixPlotSettings
> = ctx => {
  const colorSync = transitionMatrixColorSync()

  usePlotSync(
    colorSync,
    () => ctx.item.id,
    () => {
      const meta = (ctx.view()?.meta ?? null) as TransitionViewMeta | null
      if (!meta || !meta.isDefaultColorRange) return null
      return {
        groupKey: meta.syncGroupKey,
        colorScaleKey: meta.colorScaleKey,
        w: ctx.item.w,
        h: ctx.item.h,
        dataMax: meta.ownDataMax,
      }
    }
  )

  return {
    props: view => {
      const meta = view.meta as TransitionViewMeta
      if (!meta.isDefaultColorRange) return {}
      const syncedMax = colorSync.getSyncedMax(
        meta.syncGroupKey,
        meta.colorScaleKey,
        ctx.item.w,
        ctx.item.h
      )
      if (syncedMax <= meta.ownDataMax) return {}
      return { colorValueRange: [0, syncedMax] as [number, number] }
    },
  }
}
