import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { distributionValueAxisSync } from './valueAxisSync.svelte'
import type { DistributionViewMeta } from './types'

/**
 * Screen recipe: value-axis sync for a distribution plot. Registers the plot's
 * data max under (its type, its metric instance, its grid size) and overlays a
 * synced timeline on the figure when a sibling's max is larger. A user-set
 * `scaleRange` opts out; export renders the raw (unsynced) view.
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

    usePlotSync(
      distributionValueAxisSync,
      () => ctx.item.id,
      () => {
        const meta = (ctx.view()?.meta ?? null) as DistributionViewMeta | null
        if (!meta || meta.syncKey === null || hasCustomScale()) return null
        return {
          plotType: ctx.item.type,
          metricInstanceId: meta.syncKey,
          w: ctx.item.w,
          h: ctx.item.h,
          dataMax: meta.dataMax,
        }
      }
    )

    return {
      props: view => {
        const meta = view.meta as DistributionViewMeta
        if (hasCustomScale() || meta.syncKey === null) return {}
        const syncedMax = distributionValueAxisSync.getSyncedMax(
          ctx.item.type,
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
}
