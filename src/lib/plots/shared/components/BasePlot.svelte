<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { fade } from 'svelte/transition'

  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils/plotSizeUtility'
  import { PlotPlaceholder } from '$lib/plots/shared/components'

  import type { GridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/workspace/commands'

  interface LayoutConfig {
    headerHeight?: number
    horizontalPadding?: number
    contentPadding?: number
  }

  interface Props {
    settings: GridType
    onWorkspaceCommand?: (command: WorkspaceCommand) => void
    layoutConfig?: LayoutConfig
    // If provided, controls the fade in. If not provided, it assumes data is always ready or handled by parent.
    // If false is passed, it shows placeholder.
    hasData?: boolean
    
    // Optional dimensions override if parent already calculated them
    dimensions?: { width: number; height: number }

    // Optional height override for the inner content (e.g. for scrolling plots)
    contentHeight?: number
    // Optional overflow setting for the figure container
    overflow?: string

    // Snippets
    header?: Snippet
    figure?: Snippet<[{ width: number; height: number }]>
  }

  let { 
    settings, 
    onWorkspaceCommand, 
    layoutConfig = {}, 
    hasData = true,
    dimensions: parentDimensions,
    contentHeight,
    overflow = 'hidden',
    header,
    figure
  }: Props = $props()

  // Default layout constants
  const DEFAULT_LAYOUT = {
    HEADER_HEIGHT: 150,
    HORIZONTAL_PADDING: 40,
    CONTENT_PADDING: 5,
  }

  const dimensions = $derived.by(() => {
    if (parentDimensions) return parentDimensions

    return calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      layoutConfig.headerHeight ?? DEFAULT_LAYOUT.HEADER_HEIGHT,
      layoutConfig.horizontalPadding ?? DEFAULT_LAYOUT.HORIZONTAL_PADDING,
      layoutConfig.contentPadding ?? DEFAULT_LAYOUT.CONTENT_PADDING
    )
  })

  let mounted = $state(false)

  onMount(() => {
    mounted = true
  })
</script>

<div class="base-plot-container" style="overflow: {overflow}">
  <div class="header">
    {#if header}
      {@render header()}
    {/if}
  </div>

  <div class="figure" style="height: {contentHeight ? `${contentHeight}px` : `${dimensions.height}px`}">
    {#if mounted && hasData}
      <div
        class="figure-content"
        in:fade={{ duration: 300 }}
        style="height: {contentHeight ?? dimensions.height}px"
      >
        {#if figure}
            {@render figure({ width: dimensions.width, height: dimensions.height })}
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

  .header {
    padding: 0 0 10px 0;
    margin-bottom: 10px;
    background-color: var(--c-white);
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
