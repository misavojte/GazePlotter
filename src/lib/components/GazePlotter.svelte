<script lang="ts">

  import ScarfPlot from './Plot/ScarfPlot/ScarfPlot.svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { scarfPlotStates, setDefaultScarfPlotState } from '../stores/scarfPlotsStore'
  import Toaster from './Toaster/Toaster.svelte'
  import Modal from './Modal/Modal.svelte'
  import Panel from './Panel/Panel.svelte'
  import { onMount } from 'svelte'
  import EmptyPlot from './Plot/EmptyPlot/EmptyPlot.svelte'
  export let title: string = 'GazePlotter'

  $: isProcessingFile = $processingFileStateStore

  $: switch (isProcessingFile) {
    case 'done':
      console.log('done GPS')
      setDefaultScarfPlotState()
      break
  }

  $: scarfs = $scarfPlotStates

  onMount(() => {
    setDefaultScarfPlotState()
  })
</script>

<div id="GP-gazeplotter">
    <header>
        <h2>{title}</h2>
        <p>
            Guide to visualizing gaze data via interactive scarf charts in the browser from eye-tracker software output files.
        </p>
        <Panel />
    </header>
    <main>
        {#each scarfs as scarf (scarf.scarfPlotId)}
            <ScarfPlot scarfPlotId={scarf.scarfPlotId} />
        {/each}
        {#if scarfs.length === 0}
            <EmptyPlot />
        {/if}
    </main>
    <Modal />
    <Toaster />
</div>

<style>
    header {
        width: 100%;
        max-width: 1080px;
        margin: auto;
    }
    main {
        display: flex;
        gap: 20px;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: calc(100% - 80px);
        margin: auto auto 120px;
        padding: 80px 16px;
        box-shadow: inset 0 2px 10px rgb(0 0 0 / 25%);
        background-color: #dbdbdc;
        background-image: linear-gradient(rgb(0 0 0 / 3%) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0 / 3%) 1px, transparent 1px);
        background-size: 30px 30px;
        border-radius: 15px;
    }
    :global(:root) {
        --c-brand: #cd1404;
        --c-white: #fff;
        --c-lightgrey: #f3f3f3;
        --c-darkgrey: #dbdbdc;
        --c-black: rgba(0, 0, 0, 0.75);
    }
    #GP-gazeplotter {
        font-family: 'Roboto', sans-serif;
        font-size: 16px;
        line-height: 1.5;
        color: var(--c-black);
    }
</style>
