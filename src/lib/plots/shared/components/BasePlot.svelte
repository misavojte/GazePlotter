<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { fade } from 'svelte/transition'

  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared'
  import PlotPlaceholder from './PlotPlaceholder.svelte'
  import { PLOT_BASE_CHROME_HEIGHT } from '$lib/plots/shared/const'

  interface PlotFrame {
    w: number
    h: number
  }

  interface Props {
    item: PlotFrame
    // If false, shows the loading placeholder instead of the figure.
    hasData?: boolean
    figure?: Snippet<[{ width: number; height: number }]>
  }

  let { item, hasData = true, figure }: Props = $props()

  // Plots render through the Pane (no inline header), so the figure subtracts
  // only the base chrome — grid-item header + body padding — and fills the
  // rest of the body.
  const dimensions = $derived(
    calculatePlotDimensionsWithHeader(
      item.w,
      item.h,
      DEFAULT_GRID_CONFIG,
      PLOT_BASE_CHROME_HEIGHT
    )
  )

  let mounted = $state(false)

  onMount(() => {
    mounted = true
  })
</script>

<div class="base-plot-container">
  <!-- Figure is plain selectable surface now: individual plot figures
       declare spatial blocked regions (plot area + interactive legend)
       on their own canvas via `canvasBlockSelect`. That way the chrome
       around the plot — title, axis labels, padding, non-interactive
       legend — is clickable-to-select, matching the user expectation
       that clicking a plot opens its Pane. -->
  <div class="figure" style="height: {dimensions.height}px">
    {#if mounted && hasData}
      <div
        class="figure-content"
        in:fade={{ duration: 300 }}
        style="height: {dimensions.height}px"
      >
        {#if figure}
          {@render figure({
            width: dimensions.width,
            height: dimensions.height,
          })}
        {:else}
          <PlotPlaceholder
            width={dimensions.width}
            height={dimensions.height}
          />
        {/if}
      </div>
    {:else}
      <div class="figure-content" style="height: {dimensions.height}px">
        <PlotPlaceholder
          width={dimensions.width}
          height={dimensions.height}
          message={'Loading visualization...'}
          loading={true}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .base-plot-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    /* overflow handled by inline style */
  }

  .figure {
    position: relative;
    /* overflow handled by inline style */
  }

  .figure-content {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
