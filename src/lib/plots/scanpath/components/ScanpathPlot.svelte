<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { BasePlot } from '$lib/plots/shared/components'
  import ScanpathPlotFigure from './ScanpathPlotFigure.svelte'
  import { getScanpathView } from '../core/view'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'
  import type { ScanpathPlotItem } from '../types'

  interface Props {
    item: ScanpathPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from.
  const viewData = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: () => item.settings,
    derive: s => getScanpathView(engine, s),
  })
  const view = $derived(viewData.current)
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      <ScanpathPlotFigure {...view.props} {width} {height} />
    </div>
  {/snippet}
</BasePlot>

<style>
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
