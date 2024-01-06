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
  $: isDisabled = zoom <= 0
  const handleClick = () => {
    if (!isDisabled) {
      updateZoom(scarfId, zoom - 1)
    }
  }
</script>

<MinorButton on:click={handleClick} {isDisabled}>
  <span>-</span>
</MinorButton>

<style>
  span {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: -2px;
  }
</style>
