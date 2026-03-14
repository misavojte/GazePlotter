<script lang="ts">
  import type { AoiStreamPlotItem } from '$lib/plots/aoi-stream/types'
  import AoiStreamPlotFigure from '$lib/plots/aoi-stream/components/AoiStreamPlotFigure.svelte'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/core'
  import {
    DEFAULT_CANVAS_EXPORT_MARGIN,
    getWorkspaceCanvasExportDimensions,
  } from '$lib/modals/export/shared/helpers'
  import { PlotExportWrapper } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, grid } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const exportDimensions = $derived(
    getWorkspaceCanvasExportDimensions(
      item,
      grid.config,
      DEFAULT_CANVAS_EXPORT_MARGIN
    )
  )

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

<PlotExportWrapper
  defaultFileName="GazePlotter-AoiStreamPlot"
  defaultWidth={exportDimensions.width}
  defaultHeight={exportDimensions.height}
  defaultMargin={DEFAULT_CANVAS_EXPORT_MARGIN}
>
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
