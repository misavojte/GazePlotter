<script lang="ts">

  import ScarfPlot from './Plot/ScarfPlot/ScarfPlot.svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { scarfPlotStates, setDefaultScarfPlotState } from '../stores/scarfPlotsStore'
  import Toaster from './Toaster/Toaster.svelte'
  import Modal from './Modal/Modal.svelte'
  import Panel from './Panel/Panel.svelte'
  import { onMount } from 'svelte'
  import EmptyPlot from './Plot/EmptyPlot/EmptyPlot.svelte'

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
    <div class="panel-container">
        <Panel />
    </div>
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

    main {
        display: flex;
        gap: 20px;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        margin: auto;
        padding: 80px 16px;
        box-shadow: inset 0 2px 10px rgb(0 0 0 / 25%);
        background-color: var(--c-lightgrey);
        background-image: linear-gradient(var(--c-darkgrey) 1px, transparent 1px), linear-gradient(90deg, var(--c-darkgrey) 1px, transparent 1px);
        background-size: 30px 30px;
    }
    :global(:root) {
        --c-brand: #cd1404;
        --c-white: #fff;
        --c-lightgrey: #ebebef;
        --c-darkgrey: #e4e4e9;
        --c-black: rgba(0, 0, 0, 0.75);
    }
    #GP-gazeplotter {
        font-family: inherit;
        font-size: 16px;
        line-height: 1.5;
        color: var(--c-black);
    }
    .panel-container {
        max-width: 1220px;
        margin-inline: auto;
        margin-block: 40px;
    }
</style>
