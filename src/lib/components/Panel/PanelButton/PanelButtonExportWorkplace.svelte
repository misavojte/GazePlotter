<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/stores/modalStore.ts'
  import ModalContentDownloadWorkplace from '$lib/components/Modal/ModalContent/ModalContentDownloadWorkplace.svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore.ts'

  $: isDisabled = $processingFileStateStore === 'processing'

  const handleClick = () => {
    modalStore.open(ModalContentDownloadWorkplace, 'Download workplace')
  }
</script>

<MajorControlButton {isDisabled} on:click={handleClick}>
  Download workspace
</MajorControlButton>
