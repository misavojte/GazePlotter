<script lang="ts">
  import ScarfPlotLegendGroup from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegendGroup.svelte'
  import type { StylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index'
  export let filling: StylingScarfFillingType
</script>

{#key filling}
  <ScarfPlotLegendGroup
    on:legendIdentifier
    title="Fixations"
    fillings={filling.aoi}
  />
  <ScarfPlotLegendGroup
    on:legendIdentifier
    title="Non-fixations"
    fillings={filling.category}
  />
  {#if filling.visibility.length > 0}
    <ScarfPlotLegendGroup
      on:legendIdentifier
      title="Is AOI visible"
      fillings={filling.visibility}
      isVisibility={true}
    />
  {/if}
{/key}
