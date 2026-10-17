<script lang="ts">
  import { ButtonPreset } from '$lib/shared/components'
  import { CheckboxListField, Step } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getParticipants } from '$lib/data/engine'
  import { mapSelectableItems, toggleSetValue } from './helpers'
  import {
    isGroupSelected,
    participantGroupPresets,
    participantsSelectionSummary,
    toggleGroupSelection,
  } from './participants'

  /**
   * The participant step every export modal shares: individual checkmarks,
   * selection chips as one-click presets, and (via CheckboxListField) search with
   * found-scoped bulk actions on long lists.
   */
  interface Props {
    n: number
    selected: Set<string>
  }

  let { n, selected = $bindable() }: Props = $props()
  const { engine } = getGazePlotterSession()

  const allParticipants = $derived(getParticipants(engine, -1))
  const groupPresets = $derived(participantGroupPresets(engine))
  const done = $derived(selected.size > 0)

  const items = $derived(
    mapSelectableItems(
      allParticipants.map(p => ({ value: p.id.toString(), label: p.displayedName })),
      selected
    )
  )
</script>

<Step
  {n}
  title="Choose participants"
  description="Selection chips toggle a whole participant selection at once; individual checkmarks refine the result."
  summary={participantsSelectionSummary(engine, selected)}
  {done}
>
  <CheckboxListField
    title="Participants"
    {items}
    onItemChange={(key, checked) => (selected = toggleSetValue(selected, key, checked))}
    hasError={!done}
    errorMessage="Select at least one participant to export"
  >
    {#snippet presets()}
      {#each groupPresets as group (group.id)}
        <ButtonPreset
          label={group.name}
          isActive={isGroupSelected(group.participantsIds, selected)}
          onclick={() => (selected = toggleGroupSelection(group.participantsIds, selected))}
        />
      {/each}
    {/snippet}
  </CheckboxListField>
</Step>
