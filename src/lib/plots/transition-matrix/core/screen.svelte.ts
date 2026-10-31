import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import type { TransitionMatrixView } from './view'
import type { TransitionMatrixPlotSettings } from '../types'

/**
 * Color-axis sync: matrices sharing metric, color scale and grid size share the
 * largest data max while their color range is default. Export never syncs.
 */
export const transitionMatrixScreen: PlotScreenFactory<
  TransitionMatrixPlotSettings,
  TransitionMatrixView
> = ctx => {
  const syncedMax = useSyncedMax(ctx, 'transition-matrix-color', () => {
    const meta = ctx.view()?.meta
    if (!meta?.isDefaultColorRange) return null
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
