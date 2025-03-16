<script lang="ts">
  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index.js'
  import ScarfPlotLegendItem from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegendItem.svelte'

  interface Props {
    fillings: SingleStylingScarfFillingType[]
    title: string
    isVisibility?: boolean
    onlegendIdentifier?: (identifier: string) => void
  }

  let {
    fillings,
    title,
    isVisibility = false,
    onlegendIdentifier = () => {},
  }: Props = $props()

  // Wrapped handler function to ensure we're passing a function
  const handleIdentifier = (identifier: string) => {
    if (typeof onlegendIdentifier === 'function') {
      onlegendIdentifier(identifier)
    }
  }
</script>

<div class="chlegendtitle">
  {title}
</div>
<div class="chlegend">
  {#each fillings as filling}
    <ScarfPlotLegendItem
      onlegendIdentifier={handleIdentifier}
      legend={filling}
      {isVisibility}
    />
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
