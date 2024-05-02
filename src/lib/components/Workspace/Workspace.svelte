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

  const itemSize = { height: 40, width: 40 }

  let gridController: GridController

  const findPositionForItem = (w: number, h: number) => {
    if (gridController) {
      const result = gridController.getFirstAvailablePosition(w, h)
      return result
    } else {
      return { x: 0, y: 0 }
    }
  }

  const loadingGridStoreState: AllGridTypes[] = [
    {
      id: -12,
      x: 4,
      y: 0,
      w: 4,
      h: 4,
      min: { w: 3, h: 3 },
      type: 'load',
    },
  ]

  const returnDefaultGridStoreState = (): AllGridTypes[] => {
    return [
      {
        id: 0,
        x: 0,
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

  let state = returnDefaultGridStoreState()
  let store = createGridStore(state, findPositionForItem)
  setContext('gridStore', store)

  $: switch ($processingFileStateStore) {
    case 'done':
      store.set(returnDefaultGridStoreState())
      processingFileStateStore.set('idle')
      break
    case 'processing':
      store.set(loadingGridStoreState)
      break
  }

  const calculateHeight = (store: AllGridTypes[]) => {
    return store.reduce((acc, item) => {
      const itemBottomEdge = (item.y + item.h) * (itemSize.height + 10) + 15
      return Math.max(acc, itemBottomEdge)
    }, 0)
  }

  $: heightBasedOnGrid = calculateHeight($store) // Better than using on:change events of the grid which are not reliable
</script>

<div class="wrap" style="height: {heightBasedOnGrid}px;">
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
          {#if item.type === 'load'}
            <LoadPlot id={item.id} />
          {/if}
        </GridItem>
      </div>
    {/each}
  </Grid>
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
    transition: height 0.3s;
    overflow-x: scroll;
  }

  :global(.workspace-wrapper) {
    z-index: 1;
    min-width: 1600px;
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
</style>
