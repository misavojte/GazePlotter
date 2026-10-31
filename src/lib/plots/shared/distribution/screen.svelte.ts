import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import type { DistributionView } from './figure'

/**
 * Screen recipe: value-axis sync for a distribution plot, keyed on (type, metric
 * instance, grid size). The type is in the key because different comparison
 * plots count different things per slot. A user-set `scaleRange` opts out.
 */
export function distributionValueAxisScreen<
  S extends { scaleRange?: [number, number] },
>(): PlotScreenFactory<S, DistributionView> {
  return ctx => {
    const syncedMax = useSyncedMax(ctx, 'distribution-value-axis', () => {
      const meta = ctx.view()?.meta
      if (!meta || meta.syncKey === null) return null
      const range = ctx.item.settings.scaleRange
      if (range !== undefined && (range[0] !== 0 || range[1] !== 0)) return null
      return {
        key: [ctx.item.type, meta.syncKey, ctx.item.w, ctx.item.h],
        own: meta.dataMax,
      }
    })

    return {
      props: view => {
        const max = syncedMax()
        if (max === null) return {}
        return { timeline: createAdaptiveTimeline(view.props.timeline.minValue, max, 6) }
      },
    }
  }
}
