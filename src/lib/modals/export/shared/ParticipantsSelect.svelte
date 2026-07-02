<script lang="ts">
  import { ButtonPreset } from '$lib/shared/components'
  import { CheckboxListField } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getParticipants } from '$lib/data/engine'
  import { mapSelectableItems, toggleSetValue } from './helpers'
  import {
    isGroupSelected,
    participantGroupPresets,
    toggleGroupSelection,
  } from './participants'

  /**
   * The participant picker every export modal shares: individual checkmarks,
   * group chips as one-click presets, and (via CheckboxListField) search with
   * found-scoped bulk actions on long lists.
   */
  interface Props {
    selected: ReadonlySet<string>
    onchange: (next: Set<string>) => void
    hasError?: boolean
  }

  let { selected, onchange, hasError = false }: Props = $props()
  const { engine } = getGazePlotterSession()

  const allParticipants = $derived(getParticipants(engine, -1))
  const groupPresets = $derived(participantGroupPresets(engine))

  const items = $derived(
    mapSelectableItems(
      allParticipants.map(p => ({ value: p.id.toString(), label: p.displayedName })),
      selected
    )
  )
</script>

<CheckboxListField
  title="Participants"
  {items}
  onItemChange={(key, checked) => onchange(toggleSetValue(selected, key, checked))}
  {hasError}
  errorMessage="Select at least one participant to export"
>
  {#snippet presets()}
    {#each groupPresets as group (group.id)}
      <ButtonPreset
        label={group.name}
        isActive={isGroupSelected(group.participantsIds, selected)}
        onclick={() => onchange(toggleGroupSelection(group.participantsIds, selected))}
      />
    {/each}
  {/snippet}
</CheckboxListField>
