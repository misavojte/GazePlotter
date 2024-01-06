<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/stores/modalStore.ts'
  import ModalContentDownloadWorkplace from '$lib/components/Modal/ModalContent/ModalContentDownloadWorkplace.svelte'

  const handleClick = () => {
    modalStore.open(ModalContentDownloadWorkplace, 'Download workplace')
  }
</script>

<MajorControlButton on:click={handleClick}>
  Download workplace
</MajorControlButton>
