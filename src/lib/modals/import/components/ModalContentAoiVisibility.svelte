<script lang="ts">
  import GeneralSelectBase from '$lib/shared/components/GeneralSelect.svelte'

  import { GeneralInputFile } from '$lib/shared/components'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { processAoiVisibility } from '$lib/modals/import/utility/aoiVisibilityServices'
  import { getStimuliOptions, getParticipantOptions } from '$lib/plots/shared'
  import type { UpdateAoiVisibilityCommand } from '$lib/workspace/commands'

  interface Props {
    source: string
    onWorkspaceCommand: (command: UpdateAoiVisibilityCommand) => void
  }

  let { source, onWorkspaceCommand }: Props = $props()
  const { engine, modalState, toastState } = getGazePlotterSession()

  let files: FileList | null = $state(null)
  let selectedStimulusId = $state('0')
  let selectedParticipantId = $state('all')

  const stimuliOptions = getStimuliOptions(engine)
  const participantOptions = [{ label: 'To all', value: 'all' }].concat(
    getParticipantOptions(engine)
  )
  const handleSubmit = () => {
    if (files === null) {
      toastState.addError('No file selected')
      return
    }
    try {
      const stimulusId = parseInt(selectedStimulusId)
      const participantId =
        selectedParticipantId === 'all' ? null : parseInt(selectedParticipantId)
      processAoiVisibility(
        engine,
        stimulusId,
        participantId,
        files,
        source,
        onWorkspaceCommand
      ).then(() => {
        modalState.close()
      })
    } catch (e) {
      console.error(e)
      const message = e instanceof Error ? e.message : 'Unknown error'
      toastState.addError('Could not read file. ' + message)
    }
  }

  const handleCancel = () => {
    modalState.close()
  }
</script>

<div class="content">
  <GeneralSelectBase
    label="For stimulus"
    options={stimuliOptions}
    bind:value={selectedStimulusId}
  />
  <GeneralSelectBase
    label="For participant"
    options={participantOptions}
    bind:value={selectedParticipantId}
  />
  <GeneralInputFile label="AOI visibility file" bind:files />
</div>
<ModalButtons
  buttons={[
    {
      label: 'Apply',
      onclick: handleSubmit,
      variant: 'primary',
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
    },
  ]}
/>

<style>
  .content {
    margin-bottom: 25px;
  }
</style>
