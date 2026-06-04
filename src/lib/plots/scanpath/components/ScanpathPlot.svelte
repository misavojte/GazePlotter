<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { BasePlot } from '$lib/plots/shared/components'
  import ScanpathPlotFigure from './ScanpathPlotFigure.svelte'
  import { getScanpathView } from '../core/view'
  import type { ScanpathPlotItem, ScanpathUnavailableReason } from '../types'

  interface Props {
    item: ScanpathPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from.
  const view = $derived(getScanpathView(engine, item.settings))

  const unavailableMessage = $derived(
    view.unavailableReason ? messageForReason(view.unavailableReason) : null
  )

  function messageForReason(reason: ScanpathUnavailableReason): string {
    switch (reason) {
      case 'no-spatial-data':
        return 'This workspace has no spatial fixation coordinates.'
      case 'no-fixations':
        return 'No fixations recorded for this participant on this stimulus.'
      case 'no-spatial-coords':
        return 'No spatial coordinates recorded for this participant on this stimulus.'
    }
  }
</script>

<BasePlot {item} hasData={view.props !== null} {unavailableMessage}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if view.props}
        <ScanpathPlotFigure {...view.props} {width} {height} />
      {/if}
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
