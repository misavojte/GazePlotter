<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/stores/modalStore'
  import ModalContentDownloadWorkplace from '$lib/components/Modal/ModalContent/ModalContentDownloadWorkplace.svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = () => {
    modalStore.open(ModalContentDownloadWorkplace, 'Download workplace')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Download workspace
</MajorControlButton>
