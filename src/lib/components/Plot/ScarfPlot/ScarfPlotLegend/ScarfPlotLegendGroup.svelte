<script lang="ts">

  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index.js'
  import ScarfPlotLegendItem from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegendItem.svelte'

  export let fillings: SingleStylingScarfFillingType[]
  export let title: string
  export let isVisibility = false
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
