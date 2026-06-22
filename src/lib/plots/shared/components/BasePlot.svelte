<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { fade } from 'svelte/transition'

  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared'
  import PlotPlaceholder from './PlotPlaceholder.svelte'
  import { PLOT_BASE_CHROME_HEIGHT } from '$lib/plots/shared/const'

  interface LayoutConfig {
    headerHeight?: number
  }

  interface PlotFrame {
    w: number
    h: number
  }

  interface Props {
    item: PlotFrame
    layoutConfig?: LayoutConfig
    // If provided, controls the fade in. If not provided, it assumes data is always ready or handled by parent.
    // If false is passed, it shows placeholder.
    hasData?: boolean
    // If provided and hasData is false, shows a static message instead of spinner.
    unavailableMessage?: string | null

    // Optional dimensions override if parent already calculated them
    dimensions?: { width: number; height: number }

    // Optional height override for the inner content (e.g. for scrolling plots)
    contentHeight?: number

    // Snippets
    figure?: Snippet<[{ width: number; height: number }]>
  }

  let {
    item,
    layoutConfig = {},
    hasData = true,
    unavailableMessage = null,
    dimensions: parentDimensions,
    contentHeight,
    figure,
  }: Props = $props()

  // Plots render through the Pane (no inline header), so the figure subtracts
  // only the base chrome — grid-item header + body padding — and fills the rest
  // of the body. `layoutConfig.headerHeight` can still override per plot.
  const effectiveHeaderHeight = $derived(
    layoutConfig.headerHeight ?? PLOT_BASE_CHROME_HEIGHT
  )

  const dimensions = $derived.by(() => {
    if (parentDimensions) return parentDimensions

    return calculatePlotDimensionsWithHeader(
      item.w,
      item.h,
      DEFAULT_GRID_CONFIG,
      effectiveHeaderHeight
    )
  })

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
  <div
    class="figure"
    style="height: {contentHeight
      ? `${contentHeight}px`
      : `${dimensions.height}px`}"
  >
    {#if mounted && hasData}
      <div
        class="figure-content"
        in:fade={{ duration: 300 }}
        style="height: {contentHeight ?? dimensions.height}px"
      >
        {#if figure}
          {@render figure({
            width: dimensions.width,
            height: dimensions.height,
          })}
        {:else}
          <!-- If no figure snippet provided, we could fallback to placeholder or nothing -->
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
          message={unavailableMessage ?? 'Loading visualization...'}
          loading={!unavailableMessage}
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
