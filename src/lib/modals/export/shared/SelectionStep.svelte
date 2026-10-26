<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ButtonPreset } from '$lib/shared/components'
  import { CheckboxListField, Step } from '$lib/modals'
  import { mapSelectableItems, toggleSetValue } from './helpers'
  import { useContextMenuAction, type MenuItem } from '$lib/context-menu'
  import {
    isPresetSelected,
    presetSelectionSummary,
    togglePreset,
    type SelectionPreset,
  } from './presets'

  /**
   * One export step for a checklist axis: individual checkmarks, saved
   * selections as one-click chips (shown only when there are any), and (via
   * CheckboxListField) search with found-scoped bulk actions on long lists.
   */
  interface Props {
    n: number
    title: string
    /** The checklist's heading ("Participants"). */
    listTitle: string
    /** One item, singular and lower-case ("participant"), for the error and chips text. */
    noun: string
    /** What a ticked item contributes to the file; empty to say only the chips text. */
    description?: string
    items: readonly { value: string; label: string; sublabel?: string }[]
    presets?: readonly SelectionPreset[]
    selected: Set<string>
    /** Appended to the collapsed summary ("No_AOI left out"). */
    summaryNote?: string
    /** Extra guidance rendered above the checklist. */
    children?: Snippet
  }

  let {
    n,
    title,
    listTitle,
    noun,
    description = '',
    items,
    presets = [],
    selected = $bindable(),
    summaryNote,
    children,
  }: Props = $props()

  const done = $derived(items.some(item => selected.has(item.value)))
  const chipsText = $derived(
    `Selection chips toggle a whole ${noun} selection at once; individual checkmarks refine the result.`
  )
  const checklist = $derived(mapSelectableItems(items, selected))

  const contextMenuAction = useContextMenuAction()
  // Right-click on a chip: its members alone, or every item but them.
  function chipMenu(preset: SelectionPreset): MenuItem[] {
    const members = new Set(preset.members)
    return [
      { label: 'Select only these', onAction: () => (selected = new Set(members)) },
      {
        label: 'Select all but these',
        onAction: () =>
          (selected = new Set(items.map(item => item.value).filter(key => !members.has(key)))),
      },
    ]
  }
</script>

{#snippet chips()}
  {#each presets as preset (preset.id)}
    <span class="chip" use:contextMenuAction={{ trigger: 'pointer', items: chipMenu(preset) }}>
      <ButtonPreset
        label={preset.name}
        isActive={isPresetSelected(preset.members, selected)}
        onclick={() => (selected = togglePreset(preset.members, selected))}
      />
    </span>
  {/each}
{/snippet}

<Step
  {n}
  {title}
  description={presets.length > 0 ? [description, chipsText].filter(Boolean).join(' ') : description}
  summary={[presetSelectionSummary(items, presets, selected), summaryNote]
    .filter(Boolean)
    .join(' · ')}
  {done}
>
  {@render children?.()}
  <CheckboxListField
    title={listTitle}
    items={checklist}
    onItemChange={(key, checked) => (selected = toggleSetValue(selected, key, checked))}
    hasError={!done}
    errorMessage={`Select at least one ${noun} to export`}
    presets={presets.length > 0 ? chips : undefined}
  />
</Step>

<style>
  /* Layout-neutral: only carries the chip's right-click menu. */
  .chip {
    display: contents;
  }
</style>
