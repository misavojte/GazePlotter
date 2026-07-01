<script lang="ts">
  import { untrack } from 'svelte'

  import EvolvingMetricsPlotFigure from './EvolvingMetricsPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { computeEvolvingData } from '../core/view'
  import { getGazePlotterSession } from '$lib/session'

  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'
  import type { EvolvingMetricsResult } from '../types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine, grid } = getGazePlotterSession()
  const settings = $derived(item.settings)

  // Same data derivation the export modal renders from; kept inside an effect
  // (gated on redrawTimestamp + metadata). Also depends on `item.w`: the display
  // budget is derived from the plot's on-screen width, so a resize re-derives at
  // the new resolution (the budget keeps that bounded and cheap). Height does not
  // affect the budget, so `item.h` is read untracked.
  //
  // `$state.raw` is essential, not cosmetic: the result holds one plain
  // `{startMs, endMs, value, …}` object per window per participant. Under plain
  // `$state` Svelte deep-proxies all of them, so every per-window read in the
  // render/aggregate loops (renderHeatmap, renderOverlayLines, overlayAggregates)
  // becomes a proxy `get` + signal read — hundreds of thousands per repaint, the
  // dominant cost on resize/redraw. The result is always REASSIGNED wholesale
  // (never mutated), so raw is safe and reads become plain object access. (AOI
  // Timeline avoids this only because its per-bin data is a Float32Array, which
  // Svelte never proxies.)
  let resultData = $state.raw<EvolvingMetricsResult | null>(null)
  $effect(() => {
    const s = settings
    const w = item.w
    const meta = engine.metadata
    void item.redrawTimestamp
    if (!meta) return
    untrack(() => {
      resultData = computeEvolvingData(engine, s, {
        gridItems: grid.items,
        itemWidth: w,
        itemHeight: item.h,
      })
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
