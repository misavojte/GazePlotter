<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import BarPlotFigure from './BarPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getBarView } from '$lib/plots/bar/core/view'
  import { barPlotValueAxisSync } from '$lib/plots/bar/core/sync.svelte'
  import { createAdaptiveTimeline } from '$lib/plots/shared'
  import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'

  import type { BarPlotItem } from '$lib/plots/bar/types'

  interface Props {
    item: BarPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  // Same view-model the export modal renders from; the screen adds value-axis
  // sync (a synced timeline) on top — export never syncs.
  const view = $derived(getBarView(engine, settings))

  const hasCustomScale = $derived(
    settings.scaleRange !== undefined &&
      (settings.scaleRange[0] !== 0 || settings.scaleRange[1] !== 0)
  )

  usePlotSync(
    barPlotValueAxisSync,
    () => item.id,
    () => {
      if (hasCustomScale || view.syncKey === null) return null
      return {
        metricInstanceId: view.syncKey,
        w: item.w,
        h: item.h,
        dataMax: view.dataMax,
      }
    }
  )

  const timeline = $derived.by(() => {
    const raw = view.props.timeline
    if (hasCustomScale || view.syncKey === null) return raw
    const syncedMax = barPlotValueAxisSync.getSyncedMax(view.syncKey, item.w, item.h)
    if (syncedMax <= view.dataMax) return raw
    return createAdaptiveTimeline(raw.minValue, syncedMax, 6)
  })
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    <BarPlotFigure {...view.props} {width} {height} {timeline} />
  {/snippet}
</BasePlot>
