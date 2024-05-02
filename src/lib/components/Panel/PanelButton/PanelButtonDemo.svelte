<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { demoData } from '$lib/const/demoData.ts'
  import { data } from '$lib/stores/dataStore.ts'
  import { addSuccessToast } from '$lib/stores/toastStore.ts'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore.ts'

  $: isDisabled = $processingFileStateStore === 'processing'

  const handleClick = async () => {
    data.set(demoData)
    processingFileStateStore.set('done')
    addSuccessToast('Demo data loaded')
  }
</script>

<MajorControlButton {isDisabled} on:click={handleClick}
  >Reload demo</MajorControlButton
>
