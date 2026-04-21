<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { BarPlotItem } from '$lib/plots/bar/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import BarPlotFigure from './BarPlotFigure.svelte'
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import { getBarPlotAxisLabel } from '$lib/plots/bar/const'
  import { resolveInstance } from '$lib/metrics'

  interface Props {
    item: BarPlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const barPlotData = $derived(
    getBarPlotData(engine, {
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      metricInstanceId: settings.metricInstanceId,
      scaleRange: settings.scaleRange,
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
      orderBy: settings.orderBy,
      orderDirection: settings.orderDirection,
      statisticalOverlay: settings.statisticalOverlay,
    })
  )
  const data = $derived(barPlotData.data)
  const timeline = $derived(barPlotData.timeline)

  const resolvedInstance = $derived(
    resolveInstance(engine.metadata?.metricInstances ?? [], settings.metricInstanceId ?? null)
  )

  const axisLabel = $derived(
    getBarPlotAxisLabel(
      resolvedInstance,
      settings.timelineStart,
      settings.timelineEnd,
      settings.statisticalOverlay
    )
  )
</script>

<BarPlotFigure
  width={exportProps.width}
  height={exportProps.height}
  {data}
  {timeline}
  {axisLabel}
  barPlottingType={settings.barPlottingType}
  barWidth={200}
  barSpacing={20}
  onDataHover={() => {}}
  statisticalOverlay={settings.statisticalOverlay}
  noMetric={barPlotData.noMetric ?? false}
  dpiOverride={exportProps.dpiOverride}
  marginTop={exportProps.marginTop}
  marginRight={exportProps.marginRight}
  marginBottom={exportProps.marginBottom}
  marginLeft={exportProps.marginLeft}
/>
