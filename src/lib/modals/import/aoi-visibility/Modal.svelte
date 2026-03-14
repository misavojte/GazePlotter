<script lang="ts">
  import GeneralSelectBase from '$lib/shared/components/GeneralSelect.svelte'

  import { GeneralInputFile } from '$lib/shared/components'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { processAoiVisibility } from '$lib/modals/import/shared/aoiVisibilityServices'
  import { getStimuliOptions, getParticipantOptions } from '$lib/plots/shared'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, errorService, modalState, workspace } =
    getGazePlotterSession()

  let files: FileList | null = $state(null)
  let selectedStimulusId = $state('0')
  let selectedParticipantId = $state('all')
  let validationMessage = $state<string | null>(null)

  const stimuliOptions = getStimuliOptions(engine)
  const participantOptions = [{ label: 'To all', value: 'all' }].concat(
    getParticipantOptions(engine)
  )

  $effect(() => {
    if (files !== null) {
      validationMessage = null
    }
  })

  const handleSubmit = async () => {
    if (files === null) {
      validationMessage = 'Select a file to import.'
      return
    }

    validationMessage = null

    try {
      const stimulusId = parseInt(selectedStimulusId)
      const participantId =
        selectedParticipantId === 'all' ? null : parseInt(selectedParticipantId)
      const data = await processAoiVisibility(
        engine,
        stimulusId,
        participantId,
        files
      )
      if (
        workspace.updateAoiVisibility(
          data.stimulusId,
          data.multipleAoiNames,
          data.multipleAoiVisibilityArrays,
          source,
          data.participantId
        )
      ) {
          modalState.close()
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Unknown error'

      errorService.report({
        origin: 'workspace',
        severity: 'recoverable',
        userMessage: `Could not import the AOI visibility file: ${message}`,
        cause: error,
        context: {
          selectedStimulusId,
          selectedParticipantId,
          fileCount: files.length,
          fileNames: Array.from(files, file => file.name),
        },
      })
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
  {#if validationMessage}
    <p class="validation-message">{validationMessage}</p>
  {/if}
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

  .validation-message {
    margin: 0.75rem 0 0;
    color: #8a4b00;
    font-size: 0.85rem;
    line-height: 1.4;
  }
</style>
