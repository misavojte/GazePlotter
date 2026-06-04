<script lang="ts">
  import { untrack } from 'svelte'

  import { EvolvingMetricsPlotFigure } from '$lib/plots/evolving-metrics/components'
  import { BasePlot } from '$lib/plots/shared/components'

  import { computeEvolvingData } from '../core/view'
  import { getGazePlotterSession } from '$lib/session'

  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'
  import type { EvolvingMetricsResult } from '../types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  // Same data derivation the export modal renders from; kept inside an effect
  // (gated on redrawTimestamp + metadata) to match the prior recompute timing.
  let resultData = $state<EvolvingMetricsResult | null>(null)
  $effect(() => {
    const s = settings
    const meta = engine.metadata
    void item.redrawTimestamp
    if (!meta) return
    untrack(() => {
      resultData = computeEvolvingData(engine, s)
    })
  })
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
