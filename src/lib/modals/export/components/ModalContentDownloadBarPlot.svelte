<script lang="ts">
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import BarPlotFigure from '$lib/plots/bar/components/BarPlotFigure.svelte'
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import { PlotExportWrapper } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'

  interface Props {
    settings: BarPlotGridType
  }

  let { settings }: Props = $props()
  const { engine } = getGazePlotterSession()

  const barPlotData = $derived(
    getBarPlotData(engine, {
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      aggregationMethod: settings.aggregationMethod,
      scaleRange: settings.scaleRange,
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
      orderBy: settings.orderBy,
      orderDirection: settings.orderDirection,
    })
  )
  const data = $derived(barPlotData.data)
  const timeline = $derived(barPlotData.timeline)

  import {
    getBarPlotAxisLabel,
    type BarPlotAggregationMethodId,
  } from '$lib/plots/bar/const'
  const axisLabel = $derived(
    getBarPlotAxisLabel(
      settings.aggregationMethod as BarPlotAggregationMethodId,
      settings.timelineStart,
      settings.timelineEnd
    )
  )
</script>

<PlotExportWrapper defaultFileName="GazePlotter-BarPlot">
  {#snippet children(exportProps)}
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
      dpiOverride={exportProps.dpiOverride}
      marginTop={exportProps.marginTop}
      marginRight={exportProps.marginRight}
      marginBottom={exportProps.marginBottom}
      marginLeft={exportProps.marginLeft}
    />
  {/snippet}
</PlotExportWrapper>
