import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import type { TransitionViewMeta } from './view'
import type { TransitionMatrixPlotSettings } from '../types'

/**
 * Screen recipe: color-axis sync. Matrices sharing (metric, color scale, grid
 * size) with a default color range share the largest data max so their color
 * scales are directly comparable. Setting an explicit min or max opts the plot
 * out. Export renders the raw (unsynced) view.
 */
export const transitionMatrixScreen: PlotScreenFactory<
  TransitionMatrixPlotSettings
> = ctx => {
  const syncedMax = useSyncedMax(ctx, 'transition-matrix-color', () => {
    const meta = ctx.view()?.meta as TransitionViewMeta | undefined
    if (!meta || !meta.isDefaultColorRange) return null
    return {
      key: [meta.syncGroupKey, meta.colorScaleKey, ctx.item.w, ctx.item.h],
      own: meta.ownDataMax,
    }
  })

  return {
    props: () => {
      const max = syncedMax()
      return max === null ? {} : { colorValueRange: [0, max] as [number, number] }
    },
  }
}
