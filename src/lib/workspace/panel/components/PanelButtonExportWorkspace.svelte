<script lang="ts">
  import ButtonMajor from '$lib/shared/components/ButtonMajor.svelte'

  import { downloadWorkspaceModal } from '$lib/modals/definitions'
  import { getGazePlotterSession } from '$lib/session'

  const { modalState, ingest } = getGazePlotterSession()
  let isDisabled = $derived(ingest.isLoading)

  const handleClick = () => {
    modalState.open(downloadWorkspaceModal, {})
  }
</script>

<ButtonMajor {isDisabled} onclick={handleClick}>
  Export workspace or data
</ButtonMajor>
