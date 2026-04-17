<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import MetricCorrelationHeatmap from './MetricCorrelationHeatmap.svelte'
  import MetricCorrelationSplom from './MetricCorrelationSplom.svelte'
  import MetricCorrelationButtonMenu from './MetricCorrelationButtonMenu.svelte'

  import { BasePlot } from '$lib/plots/shared/components'
  import { getMetricCorrelationData } from '../core/transformer'
  import type { MetricCorrelationItem } from '../types'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const includePoints = $derived(settings.view === 'splom')

  const result = $derived(
    getMetricCorrelationData(engine, settings, { includePoints })
  )

  const hasData = $derived(result.metrics.length >= 2 && result.sampleSize > 0)
</script>

<BasePlot {item} {hasData}>
  {#snippet header()}
    <div class="plot-controls">
      <MetricCorrelationButtonMenu {item} />
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    {#if settings.view === 'splom'}
      <MetricCorrelationSplom {width} {height} {result} />
    {:else}
      <MetricCorrelationHeatmap {width} {height} {result} />
    {/if}
  {/snippet}
</BasePlot>

<style>
  .plot-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
  }
</style>
