<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import type { SelectOption } from '$lib/shared/components'
  import type { MediaAssignment } from './definition'

  export interface Props {
    fileNames: string[]
    stimuliOptions: SelectOption[]
    /** Stimulus id → the file name already matched to it by name. */
    nameMatched: Record<string, string>
  }

  const props: Props = $props()
  // Modal props are fixed for the lifetime of one open; capturing the initial
  // values is intended, not a missed reactivity dependency.
  // svelte-ignore state_referenced_locally
  const { fileNames, stimuliOptions, nameMatched } = props
  const { modalState } = getGazePlotterSession()

  const SKIP = 'skip'

  let selections = $state<string[]>(fileNames.map(() => SKIP))

  // A stimulus holds one medium: a pick replaces its name match (labelled),
  // and a stimulus another row already picked is unavailable.
  function optionsFor(row: number): SelectOption[] {
    const taken = new Set(selections.filter((sel, i) => i !== row && sel !== SKIP))
    return [
      { label: "Don't attach", value: SKIP },
      ...stimuliOptions.map(o => ({
        ...o,
        label: nameMatched[o.value] ? `${o.label} (replaces ${nameMatched[o.value]})` : o.label,
        disabled: taken.has(o.value),
      })),
    ]
  }

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
    These files could not be attached by name. Either no stimulus has a
    matching name, or another file in this upload already matched the same
    stimulus. Pick the stimulus each one belongs to. The file becomes that
    stimulus's reference, drawn as the scanpath background.
  </p>

  <div class="file-list">
    {#each fileNames as fileName, i}
      <div class="file-row" class:ignored={selections[i] === SKIP}>
        <span class="file-name" title={fileName}>{fileName}</span>
        <Select
          label="Stimulus"
          options={optionsFor(i)}
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
    margin-bottom: 24px;
  }

  .description {
    margin-bottom: 16px;
    color: var(--c-black);
    font-size: var(--text-lg);
    line-height: var(--leading-normal);
    text-wrap: pretty;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .file-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--c-darkwhite);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    transition: opacity var(--transition-normal) ease;

    &.ignored {
      opacity: 0.5;
    }
  }

  .file-name {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--c-black);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
