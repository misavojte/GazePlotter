<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { AoiStreamPlotItem } from '$lib/plots/aoi-stream/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import AoiStreamPlotFigure from './AoiStreamPlotFigure.svelte'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/core'

  interface Props {
    item: AoiStreamPlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const streamData = $derived(
    getAoiStreamPlotData(engine, {
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      metricInstanceId: settings.metricInstanceId ?? null,
    })
  )
</script>

{#if streamData}
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
{/if}
