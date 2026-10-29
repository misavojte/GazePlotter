import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import type { DistributionViewMeta } from './types'

/**
 * Screen recipe: value-axis sync for a distribution plot. Registers the plot's
 * data max under (its type, its metric instance, its grid size) and overlays a
 * synced timeline on the figure when a sibling's max is larger. The plot type
 * is in the key: an AOI Comparison and an Eye-movement Comparison count
 * different things per slot, so they never pool axes. A user-set `scaleRange`
 * opts out; export renders the raw (unsynced) view.
 *
 * Every distribution view carries the `DistributionViewMeta` this reads, so a
 * plot opts in with one line in its definition — `screen:
 * distributionValueAxisScreen()` — and nothing in its derivation.
 */
export function distributionValueAxisScreen<
  S extends { scaleRange?: [number, number] },
>(): PlotScreenFactory<S> {
  return ctx => {
    const hasCustomScale = () => {
      const s = ctx.item.settings
      return (
        s.scaleRange !== undefined &&
        (s.scaleRange[0] !== 0 || s.scaleRange[1] !== 0)
      )
    }

    const syncedMax = useSyncedMax(ctx, 'distribution-value-axis', () => {
      const meta = ctx.view()?.meta as DistributionViewMeta | undefined
      if (!meta || meta.syncKey === null || hasCustomScale()) return null
      return {
        key: [ctx.item.type, meta.syncKey, ctx.item.w, ctx.item.h],
        own: meta.dataMax,
      }
    })

    return {
      props: view => {
        const max = syncedMax()
        if (max === null) return {}
        const raw = view.props.timeline as { minValue: number }
        return { timeline: createAdaptiveTimeline(raw.minValue, max, 6) }
      },
    }
  }
}
