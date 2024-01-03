<script>
import EmptyPlot from "$lib/components/Plot/EmptyPlot/EmptyPlot.svelte";
import ScarfPlot from "$lib/components/Plot/ScarfPlot/ScarfPlot.svelte";
import LoadPloat from "$lib/components/Plot/LoadPlot/LoadPloat.svelte";
import {processingFileStateStore} from "$lib/stores/processingFileStateStore.ts";
import {scarfPlotStates, setDefaultScarfPlotState} from "$lib/stores/scarfPlotsStore.ts";

$: isProcessingFile = $processingFileStateStore

$: switch (isProcessingFile) {
    case 'done':
        setDefaultScarfPlotState()
        loading = false
        break
    case 'processing':
        loading = true
        break
    default:
        loading = false
        break
}

$: scarfs = $scarfPlotStates

let loading = true;
</script>

<main>
    {#if loading}
        <LoadPloat />
    {:else}
        {#if scarfs.length === 0}
            <EmptyPlot />
        {:else}
            {#each scarfs as scarf (scarf.scarfPlotId)}
                <ScarfPlot scarfPlotId={scarf.scarfPlotId} />
            {/each}
        {/if}
    {/if}
</main>

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
    box-shadow: inset 0 2px 10px rgb(0 0 0 / 15%);
    background-color: var(--c-darkwhite);
    background-image: linear-gradient(var(--c-lightgrey) 1px, transparent 1px), linear-gradient(90deg, var(--c-lightgrey) 1px, transparent 1px);
    background-size: 30px 30px;
}
</style>
```