<script lang="ts">
  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index.js'
  import ScarfPlotLegendItem from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegendItem.svelte'

  interface Props {
    fillings: SingleStylingScarfFillingType[];
    title: string;
    isVisibility?: boolean;
  }

  let { fillings, title, isVisibility = false }: Props = $props();
</script>

<div class="chlegendtitle">
  {title}
</div>
<div class="chlegend">
  {#each fillings as filling}
    <ScarfPlotLegendItem on:legendIdentifier legend={filling} {isVisibility} />
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
