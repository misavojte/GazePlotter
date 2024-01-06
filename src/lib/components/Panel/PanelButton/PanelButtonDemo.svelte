<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { demoData } from '$lib/const/demoData.ts'
  import { data } from '$lib/stores/dataStore.ts'
  import { setDefaultScarfPlotState } from '$lib/stores/scarfPlotsStore.js'
  import { addSuccessToast } from '$lib/stores/toastStore.ts'
  const handleClick = async () => {
    data.set(demoData)
    setDefaultScarfPlotState()
    addSuccessToast('Demo data loaded')
  }
</script>

<MajorControlButton on:click={handleClick}>Reload demo</MajorControlButton>
