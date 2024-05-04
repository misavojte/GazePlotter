<script lang="ts">
  import EmptyPlot from '$lib/components/Plot/EmptyPlot/EmptyPlot.svelte'
  import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
  import LoadPlot from '$lib/components/Plot/LoadPlot/LoadPlot.svelte'
  import Grid, { GridItem } from 'svelte-grid-extended'
  import { fade } from 'svelte/transition'
  import { createGridStore } from '$lib/stores/gridStore.ts'
  import type { GridController } from 'svelte-grid-extended'
  import { setContext } from 'svelte'
  import type { AllGridTypes } from '$lib/type/gridType.ts'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore.ts'
  import { getScarfGridHeightFromCurrentData } from '$lib/services/scarfServices.ts'
  import { onMount } from 'svelte'

  const itemSize = { height: 40, width: 40 }

  let gridController: GridController

  const findCenterX = (width: number | null) => {
    if (!width) return 0
    return Math.max(0, Math.floor((width - 1190) / 2 / 40))
  }

  const findPositionForItem = (w: number, h: number) => {
    if (gridController) {
      const result = gridController.getFirstAvailablePosition(w, h)
      return result
    } else {
      return { x: 0, y: 0 }
    }
  }

  const returnDefaultGridStoreState = (): AllGridTypes[] => {
    return [
      {
        id: 0,
        x: findCenterX(width),
        y: 0,
        w: 20,
        h: getScarfGridHeightFromCurrentData(0, false, -1),
        min: { w: 14, h: 3 },
        type: 'scarf',
        stimulusId: 0,
        groupId: -1,
        zoomLevel: 0,
        timeline: 'absolute',
        absoluteGeneralLastVal: 0,
        absoluteStimuliLastVal: [],
        ordinalGeneralLastVal: 0,
        ordinalStimuliLastVal: [],
        dynamicAOI: true,
      },
    ]
  }

  //let state = returnDefaultGridStoreState()
  let store = createGridStore([], findPositionForItem)
  setContext('gridStore', store)

  let width: number | null = null

  $: if ($processingFileStateStore === 'done' && width) {
    store.set(returnDefaultGridStoreState())
    processingFileStateStore.set('idle')
  }

  const calculateHeight = (store: AllGridTypes[]) => {
    return store.reduce((acc, item) => {
      const itemBottomEdge = (item.y + item.h) * (itemSize.height + 10) + 30
      return Math.max(acc, itemBottomEdge)
    }, 615)
  }

  $: heightBasedOnGrid = calculateHeight($store) // Better than using on:change events of the grid which are not reliable

  onMount(() => {
    if (typeof window === 'undefined') return
    width = window.innerWidth
  })
</script>

<div class="wrap" style="height: {heightBasedOnGrid}px;">
  {#if $store && width && ($processingFileStateStore === 'idle' || $processingFileStateStore === 'fail')}
    {#if $store.length === 0 || $processingFileStateStore === 'fail'}
      <div class="wsi false-grid-item">
        <EmptyPlot />
      </div>
    {:else}
      <Grid
        {itemSize}
        collision="push"
        bind:controller={gridController}
        class={'workspace-wrapper'}
        bounds={true}
      >
        {#each $store as item (item.id)}
          <div transition:fade={{ duration: 300 }}>
            <GridItem
              id={item.id.toString()}
              previewClass={'preview'}
              bind:x={item.x}
              bind:y={item.y}
              bind:w={item.w}
              bind:h={item.h}
              min={item.min}
              class={'wsi'}
            >
              {#if item.type === 'scarf'}
                <ScarfPlot settings={item} />
              {/if}
              {#if item.type === 'empty'}
                <EmptyPlot />
              {/if}
            </GridItem>
          </div>
        {/each}
      </Grid>
    {/if}
  {:else}
    <div class="wsi false-grid-item">
      <LoadPlot />
    </div>
  {/if}
</div>

<style>
  .wrap {
    background-color: var(--c-darkwhite);
    background-image: linear-gradient(var(--c-lightgrey) 1px, transparent 1px),
      linear-gradient(90deg, var(--c-lightgrey) 1px, transparent 1px);
    background-size: 40px 40px;
    box-shadow: inset 0 2px 10px rgb(0 0 0 / 15%);
    z-index: 1;
    padding: 30px;
    transition: height 0.3s ease-out;
    overflow-x: scroll;
    overflow-y: hidden;
  }

  :global(.workspace-wrapper) {
    z-index: 1;
  }

  :global(.preview) {
    opacity: 0.25;
    border-radius: var(--rounded-lg) var(--rounded-lg) 0;
    background: var(--c-brand);
  }

  :global(.wsi) {
    border-radius: var(--rounded-lg) var(--rounded-lg) 0;
    background: var(--c-white);
    box-shadow: 0 2px 10px rgb(0 0 0 / 15%);
    display: flex;
    flex-direction: column;
  }

  .false-grid-item {
    max-width: 520px;
    margin: auto;
  }
</style>
