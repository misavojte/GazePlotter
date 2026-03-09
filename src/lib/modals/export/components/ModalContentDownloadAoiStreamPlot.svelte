<script lang="ts">
  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import AoiStreamPlotFigure from '$lib/plots/aoi-stream/components/AoiStreamPlotFigure.svelte'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/core'
  import { PlotExportWrapper } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'

  interface Props {
    settings: AoiStreamPlotGridType
  }

  let { settings }: Props = $props()
  const { engine } = getGazePlotterSession()

  const streamData = $derived.by(
    () =>
      getAoiStreamPlotData(
        engine,
        {
          stimulusId: settings.stimulusId,
          groupId: settings.groupId,
          binSize: settings.binSize,
        },
        null
      ).data
  )
</script>

<PlotExportWrapper defaultFileName="GazePlotter-AoiStreamPlot">
  {#snippet children(exportProps)}
    <AoiStreamPlotFigure
      width={exportProps.width}
      height={exportProps.height}
      data={streamData}
      alignment={settings.alignment ?? 'stream'}
      highlights={settings.highlights ?? []}
      dpiOverride={exportProps.dpiOverride}
      marginTop={exportProps.marginTop}
      marginRight={exportProps.marginRight}
      marginBottom={exportProps.marginBottom}
      marginLeft={exportProps.marginLeft}
    />
  {/snippet}
</PlotExportWrapper>
