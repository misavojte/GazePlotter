<script lang="ts">

  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index.js'
  import ScarfPlotLegendItem from './ScarfPlotLegendItem.svelte'

  export let fillings: SingleStylingScarfFillingType[]
  export let title: string
  export let isVisibility: boolean = false
</script>

    <div class='chlegendtitle'>
        {title}
    </div>
    <div class='chlegend'>
        {#each fillings as filling}
            <ScarfPlotLegendItem legend={filling} {isVisibility} />
        {/each}
    </div>

<style>
    .chlegend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
    }
    .chlegendtitle {
        font-size: 14px;
    }
</style>
