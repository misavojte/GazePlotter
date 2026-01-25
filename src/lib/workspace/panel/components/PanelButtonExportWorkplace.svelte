<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'

  import { modalState, ModalContentDownloadWorkplace } from '$lib/modals'
  import { fileState } from '$lib/file.state.svelte'

  let isDisabled = $derived(fileState.processing === 'processing')

  const handleClick = () => {
    modalState.open(ModalContentDownloadWorkplace as any, 'Download workplace')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Export workspace or data
</MajorControlButton>
