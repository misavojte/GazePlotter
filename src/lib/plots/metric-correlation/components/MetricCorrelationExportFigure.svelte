<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import type { MetricCorrelationItem } from '../types'
  import { getMetricCorrelationData } from '../core/transformer'
  import MetricCorrelationHeatmap from './MetricCorrelationHeatmap.svelte'
  import MetricCorrelationSplom from './MetricCorrelationSplom.svelte'

  interface Props {
    item: MetricCorrelationItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)
  const isSplom = $derived(settings.view === 'splom')

  const result = $derived(
    getMetricCorrelationData(engine, settings, { includePoints: isSplom })
  )
</script>

<!-- Margins are carved into the canvas by the figure (width/height are the total
     canvas), consistent with every other plot — no CSS-padding wrapper. -->
{#if isSplom}
  <MetricCorrelationSplom
    width={exportProps.width}
    height={exportProps.height}
    {result}
    dpiOverride={exportProps.dpiOverride}
    margins={exportProps.margins}
  />
{:else}
  <MetricCorrelationHeatmap
    width={exportProps.width}
    height={exportProps.height}
    {result}
    dpiOverride={exportProps.dpiOverride}
    margins={exportProps.margins}
  />
{/if}
