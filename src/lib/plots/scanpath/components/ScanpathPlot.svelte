<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { BasePlot } from '$lib/plots/shared/components'
  import ScanpathPlotFigure from './ScanpathPlotFigure.svelte'
  import { getScanpathData } from '../core/transformer'
  import type { ScanpathPlotItem, ScanpathUnavailableReason } from '../types'

  interface Props {
    item: ScanpathPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const result = $derived.by(() => getScanpathData(engine, settings))

  const unavailableMessage = $derived(
    result.kind === 'unavailable'
      ? messageForReason(result.reason)
      : null
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

<BasePlot {item} hasData={result.kind === 'ok'} {unavailableMessage}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if result.kind === 'ok'}
        <ScanpathPlotFigure
          data={result.data}
          showFixationOrder={settings.showFixationOrder}
          showNumbers={settings.showNumbers}
          {width}
          {height}
        />
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
