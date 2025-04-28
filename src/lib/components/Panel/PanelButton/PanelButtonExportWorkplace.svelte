<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { ModalContentDownloadWorkplace } from '$lib/modals'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = () => {
    modalStore.open(ModalContentDownloadWorkplace as any, 'Download workplace')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Download workspace
</MajorControlButton>
