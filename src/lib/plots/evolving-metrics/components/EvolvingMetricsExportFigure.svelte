<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import EvolvingMetricsFigure from './EvolvingMetricsFigure.svelte'
  import { getEvolvingMetricsData } from '$lib/plots/evolving-metrics/core'
  import { CanvasPlaceholder } from '$lib/plots/shared/components'

  interface Props {
    item: EvolvingMetricsItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const evolvingData = $derived.by(() =>
    getEvolvingMetricsData(engine, {
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      selectedMetricId: settings.selectedMetricId,
    })
  )
</script>

{#if evolvingData}
  <EvolvingMetricsFigure
    width={exportProps.width}
    height={exportProps.height}
    data={evolvingData}
    alignment={settings.presentation ?? 'heatmap'}
    colorScale={settings.colorScale}
    dpiOverride={exportProps.dpiOverride}
    marginTop={exportProps.marginTop}
    marginRight={exportProps.marginRight}
    marginBottom={exportProps.marginBottom}
    marginLeft={exportProps.marginLeft}
  />
{:else}
  <CanvasPlaceholder
    width={exportProps.width}
    height={exportProps.height}
    message="Select a metric"
  />
{/if}
