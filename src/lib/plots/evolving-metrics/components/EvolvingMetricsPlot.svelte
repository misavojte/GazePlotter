<script lang="ts">
  import EvolvingMetricsPlotFigure from './EvolvingMetricsPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { computeEvolvingData } from '../core/view'
  import { getGazePlotterSession } from '$lib/session'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'

  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  // Same data derivation the export modal renders from. `derive` runs untracked
  // and its result lives outside the proxy layer — the per-window result objects
  // are read as plain objects in the render/aggregate loops (this previously
  // required an explicit `$state.raw` holder). Watches `item.w`: the display
  // budget is derived from the plot's on-screen width, so a resize re-derives at
  // the new resolution (the budget keeps that bounded and cheap). Height does
  // not affect the budget, so `item.h` is deliberately not watched.
  const resultHandle = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: () => settings,
    viewOnly: ['highlights'],
    watch: () => item.w,
    derive: s =>
      computeEvolvingData(engine, s, {
        itemWidth: item.w,
        itemHeight: item.h,
      }),
  })
  const resultData = $derived(resultHandle.current)
</script>

<BasePlot {item} hasData={!!resultData}>
  {#snippet figure({ width, height })}
    {#if resultData}
      <EvolvingMetricsPlotFigure
        {width}
        {height}
        data={resultData}
        alignment={settings.presentation ?? 'heatmap'}
        colorScale={settings.colorScale}
      />
    {/if}
  {/snippet}
</BasePlot>
