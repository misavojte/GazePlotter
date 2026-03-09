<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'

  import { ModalContentDownloadWorkplace } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'

  const { modalState, ingest } = getGazePlotterSession()
  let isDisabled = $derived(ingest.isLoading)

  const handleClick = () => {
    modalState.open(ModalContentDownloadWorkplace as any, 'Download workplace')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Export workspace or data
</MajorControlButton>
