<script lang="ts">
  import ScarfPlotLegendGroup from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegendGroup.svelte'
  import type { StylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index'

  interface Props {
    filling: StylingScarfFillingType
    onlegendIdentifier: (identifier: string) => void
  }

  let { filling, onlegendIdentifier }: Props = $props()

  // Wrapped handler function to ensure we're passing a function
  const handleIdentifier = (identifier: string) => {
    if (typeof onlegendIdentifier === 'function') {
      onlegendIdentifier(identifier)
    } else {
      console.warn('onlegendIdentifier is not a function', onlegendIdentifier)
    }
  }
</script>

{#key filling}
  <ScarfPlotLegendGroup
    onlegendIdentifier={handleIdentifier}
    title="Fixations"
    fillings={filling.aoi}
  />
  <ScarfPlotLegendGroup
    onlegendIdentifier={handleIdentifier}
    title="Non-fixations"
    fillings={filling.category}
  />
  {#if filling.visibility.length > 0}
    <ScarfPlotLegendGroup
      onlegendIdentifier={handleIdentifier}
      title="Is AOI visible"
      fillings={filling.visibility}
      isVisibility={true}
    />
  {/if}
{/key}
