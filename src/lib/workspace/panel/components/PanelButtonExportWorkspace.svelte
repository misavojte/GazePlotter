<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'

  import { downloadWorkspaceModal } from '$lib/modals/definitions'
  import { getGazePlotterSession } from '$lib/session'

  const { modalState, ingest } = getGazePlotterSession()
  let isDisabled = $derived(ingest.isLoading)

  const handleClick = () => {
    modalState.open(downloadWorkspaceModal, {})
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Export workspace or data
</MajorControlButton>
