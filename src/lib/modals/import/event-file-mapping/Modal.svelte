<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import type { SelectOption } from '$lib/shared/components'
  import type { EventFileMapping } from './definition'

  interface Props {
    fileNames: string[]
    stimuliOptions: SelectOption[]
    participantOptions: SelectOption[]
  }

  let { fileNames, stimuliOptions, participantOptions }: Props = $props()
  const { modalState } = getGazePlotterSession()

  // Per-file mapping state: stimulus + participant selections
  let stimulusSelections = $state<string[]>(
    fileNames.map(() => stimuliOptions[0]?.value ?? '0')
  )
  let participantSelections = $state<string[]>(
    fileNames.map(() => 'all')
  )

  const allParticipantOptions: SelectOption[] = [
    { label: 'To all', value: 'all' },
    ...participantOptions,
  ]

  const handleSubmit = () => {
    const mapping: EventFileMapping[] = fileNames.map((_, i) => ({
      stimulusId: parseInt(stimulusSelections[i]),
      participantId:
        participantSelections[i] === 'all'
          ? null
          : parseInt(participantSelections[i]),
    }))
    modalState.finish(mapping)
  }

  const handleCancel = () => {
    modalState.close()
  }
</script>

<div class="content">
  <p class="description">
    Assign each event file to a stimulus and participant:
  </p>

  <div class="file-list">
    {#each fileNames as fileName, i}
      <div class="file-row">
        <span class="file-name" title={fileName}>{fileName}</span>
        <div class="selects">
          <Select
            label="Stimulus"
            options={stimuliOptions}
            bind:value={stimulusSelections[i]}
          />
          <Select
            label="Participant"
            options={allParticipantOptions}
            bind:value={participantSelections[i]}
          />
        </div>
      </div>
    {/each}
  </div>
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
    margin-bottom: 1.5rem;
  }

  .description {
    margin-bottom: 1rem;
    color: var(--c-text);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .file-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .file-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--c-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selects {
    display: flex;
    gap: 0.75rem;
  }
</style>
