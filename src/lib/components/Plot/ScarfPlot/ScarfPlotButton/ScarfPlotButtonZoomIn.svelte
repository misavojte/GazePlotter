<script lang="ts">
  import MinorButton from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import { scarfPlotStates, updateZoom } from '$lib/stores/scarfPlotsStore.ts'
  export let scarfId: number

  let zoom: number
  scarfPlotStates.subscribe(prev => {
    let scarfPlotState = prev.find(
      scarfPlotState => scarfPlotState.scarfPlotId === scarfId
    )
    if (scarfPlotState) zoom = scarfPlotState.zoomLevel
  })
  $: isDisabled = zoom > 3
  const handleClick = () => {
    if (!isDisabled) {
      updateZoom(scarfId, zoom + 1)
    }
  }
</script>

<MinorButton on:click={handleClick} {isDisabled}>+</MinorButton>
