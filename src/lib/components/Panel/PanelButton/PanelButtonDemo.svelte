<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { demoData } from '$lib/const/demoDataTwo'
  import { data } from '$lib/stores/dataStore'
  import { addSuccessToast } from '$lib/toaster'
  import { processingFileStateStore } from '$lib/workspace'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = async () => {
    data.set(demoData)
    processingFileStateStore.set('done')
    addSuccessToast('Demo data loaded')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}
  >Reload demo</MajorControlButton
>
