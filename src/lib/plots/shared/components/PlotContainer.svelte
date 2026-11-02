<script lang="ts" generics="K extends PlotType">
  import { getGazePlotterSession } from '$lib/session'
  import { usePlotHost } from '$lib/plots/shared/plotHost.svelte'
  import BasePlot from './BasePlot.svelte'
  import PlotViewFigure from './PlotViewFigure.svelte'
  import type { GridItemMap, PlotType } from '$lib/workspace/grid/types'

  interface Props {
    item: GridItemMap[K]
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()

  const plot = usePlotHost({ item: () => item, engine, workspace })
  const hasData = $derived(plot.view !== null && plot.view.hasData !== false)
</script>

<BasePlot {item} {hasData}>
  {#snippet figure({ width, height })}
    {#if plot.view && plot.input}
      <div class="figure-container">
        <PlotViewFigure
          view={plot.view}
          input={plot.input}
          host={plot.host}
          playback={plot.playback}
          {width}
          {height}
        />
      </div>
    {/if}
  {/snippet}
</BasePlot>

<style>
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
