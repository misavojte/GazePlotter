<script lang="ts">
  import { onDestroy } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'

  import { BarPlotFigure } from '$lib/plots/bar/components'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import { barPlotValueAxisSync } from '$lib/plots/bar/core/sync.svelte'
  import { createAdaptiveTimeline } from '$lib/plots/shared'
  import { resolveInstance } from '$lib/metrics'

  import type { BarPlotItem } from '$lib/plots/bar/types'
  import { getBarPlotAxisLabel } from '$lib/plots/bar/const'

  interface Props {
    item: BarPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const barPlotResult = $derived(getBarPlotData(engine, settings))
  const labelededBarPlotData = $derived(barPlotResult.data)

  const resolvedInstance = $derived(
    resolveInstance(engine.metadata?.metricInstances ?? [], settings.metricInstanceId ?? null)
  )
  const syncKey = $derived(resolvedInstance?.id ?? null)

  const hasCustomScale = $derived(
    settings.scaleRange !== undefined &&
      (settings.scaleRange[0] !== 0 || settings.scaleRange[1] !== 0)
  )

  $effect(() => {
    if (hasCustomScale || syncKey === null) {
      barPlotValueAxisSync.clearEntry(item.id)
      return
    }
    barPlotValueAxisSync.setEntry(item.id, {
      metricInstanceId: syncKey,
      w: item.w,
      h: item.h,
      dataMax: barPlotResult.dataMax,
    })
  })
  onDestroy(() => barPlotValueAxisSync.clearEntry(item.id))

  const timeline = $derived.by(() => {
    const raw = barPlotResult.timeline
    if (hasCustomScale || syncKey === null) return raw

    const syncedMax = barPlotValueAxisSync.getSyncedMax(
      syncKey,
      item.w,
      item.h
    )
    if (syncedMax <= barPlotResult.dataMax) return raw

    return createAdaptiveTimeline(raw.minValue, syncedMax, 6)
  })

  const axisLabel = $derived(
    getBarPlotAxisLabel(
      resolvedInstance,
      settings.timelineStart,
      settings.timelineEnd,
      settings.statisticalOverlay
    )
  )
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    <BarPlotFigure
      {width}
      {height}
      data={labelededBarPlotData}
      {timeline}
      {axisLabel}
      barPlottingType={settings.barPlottingType}
      barWidth={200}
      barSpacing={20}
      onDataHover={() => {}}
      statisticalOverlay={settings.statisticalOverlay}
      noMetric={barPlotResult.noMetric ?? false}
    />
  {/snippet}
</BasePlot>
