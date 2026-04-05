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

  const IGNORE = 'ignore'
  const ALL = 'all'

  // Per-file mapping state: stimulus + participant selections
  let stimulusSelections = $state<string[]>(
    fileNames.map(() => stimuliOptions[0]?.value ?? '0')
  )
  let participantSelections = $state<string[]>(
    fileNames.map(() => IGNORE)
  )

  // When any file is set to "To all", hide individual participant options
  let hasToAll = $derived(participantSelections.some(s => s === ALL))

  let visibleParticipantOptions = $derived<SelectOption[]>(
    hasToAll
      ? [
          { label: 'Ignore', value: IGNORE },
          { label: 'To all', value: ALL },
        ]
      : [
          { label: 'Ignore', value: IGNORE },
          { label: 'To all', value: ALL },
          ...participantOptions,
        ]
  )

  // When switching to "To all" mode, reset individual selections to "Ignore"
  $effect(() => {
    if (hasToAll) {
      for (let i = 0; i < participantSelections.length; i++) {
        if (
          participantSelections[i] !== IGNORE &&
          participantSelections[i] !== ALL
        ) {
          participantSelections[i] = IGNORE
        }
      }
    }
  })

  const handleSubmit = () => {
    const mapping: EventFileMapping[] = fileNames.map((_, i) => {
      const sel = participantSelections[i]
      return {
        stimulusId: parseInt(stimulusSelections[i]),
        participantId: sel === ALL ? null : parseInt(sel),
        skip: sel === IGNORE,
      }
    })
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
      <div class="file-row" class:ignored={participantSelections[i] === IGNORE}>
        <span class="file-name" title={fileName}>{fileName}</span>
        <div class="selects">
          <Select
            label="Stimulus"
            options={stimuliOptions}
            bind:value={stimulusSelections[i]}
          />
          <Select
            label="Participant"
            options={visibleParticipantOptions}
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
    transition: opacity 0.15s ease;
  }

  .file-row.ignored {
    opacity: 0.5;
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
