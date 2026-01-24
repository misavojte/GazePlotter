<script lang="ts">
  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import AoiStreamPlotFigure from '$lib/plots/aoi-stream/components/AoiStreamPlotFigure.svelte'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/core'
  import { PlotExportWrapper } from '$lib/modals'

  interface Props {
    settings: AoiStreamPlotGridType
  }

  let { settings }: Props = $props()

  const streamData = $derived.by(() =>
    getAoiStreamPlotData({
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      binCount: settings.binCount,
    })
  )
</script>

<PlotExportWrapper defaultFileName="GazePlotter-AoiStreamPlot">
  {#snippet children(exportProps)}
    <AoiStreamPlotFigure
      width={exportProps.width}
      height={exportProps.height}
      data={streamData}
      alignment={settings.alignment ?? 'center'}
      highlights={settings.highlights ?? []}
      dpiOverride={exportProps.dpiOverride}
      marginTop={exportProps.marginTop}
      marginRight={exportProps.marginRight}
      marginBottom={exportProps.marginBottom}
      marginLeft={exportProps.marginLeft}
    />
  {/snippet}
</PlotExportWrapper>
