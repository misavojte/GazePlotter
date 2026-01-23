<script lang="ts">
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import BarPlotFigure from '$lib/plots/bar/components/BarPlotFigure.svelte'
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import { PlotExportWrapper } from '$lib/modals'

  interface Props {
    settings: BarPlotGridType
  }

  let { settings }: Props = $props()

  const { data, timeline } = getBarPlotData({
    stimulusId: settings.stimulusId,
    groupId: settings.groupId,
    aggregationMethod: settings.aggregationMethod,
    sortBars: settings.sortBars,
    scaleRange: settings.scaleRange,
  })
</script>

<PlotExportWrapper defaultFileName="GazePlotter-BarPlot">
  {#snippet children(exportProps)}
    <BarPlotFigure
      width={exportProps.width}
      height={exportProps.height}
      {data}
      {timeline}
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
