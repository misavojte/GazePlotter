<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'

  import { InputFile } from '$lib/shared/components'
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

      // Convert parsed visibility data to event channel format
      const participantCount = engine.metadata?.participants.data.length ?? 0
      const channelDefs: string[][] = []
      const eventBuffers: number[][][] = []
      for (let i = 0; i < data.multipleAoiNames.length; i++) {
        const name = data.multipleAoiNames[i]
        // Look up AOI color from engine metadata, fallback to default
        const aoiData = engine.metadata?.aois.data[stimulusId]
        let color = '#888888'
        if (aoiData) {
          for (let j = 0; j < aoiData.length; j++) {
            if (aoiData[j][0] === name || aoiData[j][1] === name) {
              color = aoiData[j][2] ?? color
              break
            }
          }
        }
        channelDefs.push([name, name, color])

        // Convert alternating [start, end, ...] to stride-2 [start, duration, ...]
        const intervals = data.multipleAoiVisibilityArrays[i]
        const events: number[] = []
        for (let j = 0; j < intervals.length; j += 2) {
          const start = intervals[j]
          const end = intervals[j + 1]
          events.push(start, end != null ? end - start : 0)
        }

        // Build per-participant buffer: apply to selected participant or all
        const perParticipant: number[][] = Array.from({ length: participantCount }, () => [])
        if (participantId !== null) {
          perParticipant[participantId] = events
        } else {
          for (let p = 0; p < participantCount; p++) perParticipant[p] = events
        }
        eventBuffers.push(perParticipant)
      }

      if (workspace.updateEventData(stimulusId, channelDefs, eventBuffers, source)) {
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
  <Select
    label="For stimulus"
    options={stimuliOptions}
    bind:value={selectedStimulusId}
  />
  <Select
    label="For participant"
    options={participantOptions}
    bind:value={selectedParticipantId}
  />
  <InputFile label="AOI visibility file" bind:files />
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
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .validation-message {
    margin: 0.75rem 0 0;
    color: #8a4b00;
    font-size: 0.85rem;
    line-height: 1.4;
  }
</style>
