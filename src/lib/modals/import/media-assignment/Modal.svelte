<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import type { SelectOption } from '$lib/shared/components'
  import type { MediaAssignment } from './definition'

  export interface Props {
    fileNames: string[]
    stimuliOptions: SelectOption[]
  }

  const props: Props = $props()
  // Modal props are fixed for the lifetime of one open; capturing the initial
  // values is intended, not a missed reactivity dependency.
  // svelte-ignore state_referenced_locally
  const { fileNames, stimuliOptions } = props
  const { modalState } = getGazePlotterSession()

  const SKIP = 'skip'

  const options: SelectOption[] = [
    { label: "Don't attach", value: SKIP },
    ...stimuliOptions,
  ]

  let selections = $state<string[]>(fileNames.map(() => SKIP))

  const handleSubmit = () => {
    const assignments: MediaAssignment[] = selections.map(sel => ({
      stimulusId: sel === SKIP ? -1 : parseInt(sel),
      skip: sel === SKIP,
    }))
    modalState.finish(assignments)
  }

  const handleCancel = () => {
    modalState.close()
  }
</script>

<div class="content">
  <p class="description">
    These files don't match any stimulus by name. Pick the stimulus each one
    belongs to (it becomes that stimulus's reference — the scanpath background):
  </p>

  <div class="file-list">
    {#each fileNames as fileName, i}
      <div class="file-row" class:ignored={selections[i] === SKIP}>
        <span class="file-name" title={fileName}>{fileName}</span>
        <Select
          label="Stimulus"
          {options}
          bind:value={selections[i]}
        />
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
    background: var(--c-darkwhite);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    transition: opacity var(--transition-normal) ease;

    &.ignored {
      opacity: 0.5;
    }
  }

  .file-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--c-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
