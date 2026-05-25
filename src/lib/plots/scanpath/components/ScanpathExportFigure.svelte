<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import ScanpathPlotFigure from './ScanpathPlotFigure.svelte'
  import { getScanpathData } from '../core/transformer'
  import type { ScanpathPlotItem } from '../types'

  interface Props {
    item: ScanpathPlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)
  const result = $derived.by(() => getScanpathData(engine, settings))
</script>

{#if result.kind === 'ok'}
  <ScanpathPlotFigure
    data={result.data}
    showFixationOrder={settings.showFixationOrder}
    showNumbers={settings.showNumbers}
    width={exportProps.width}
    height={exportProps.height}
    dpiOverride={exportProps.dpiOverride}
    marginTop={exportProps.marginTop}
    marginRight={exportProps.marginRight}
    marginBottom={exportProps.marginBottom}
    marginLeft={exportProps.marginLeft}
  />
{/if}
