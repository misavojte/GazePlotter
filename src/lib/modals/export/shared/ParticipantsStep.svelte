<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { getAllParticipants } from '$lib/data/engine'
  import SelectionStep from './SelectionStep.svelte'
  import { participantSelectionPresets } from './participants'

  /** The participant step every export modal shares: SelectionStep fed with
   *  participants and their saved selections. */
  interface Props {
    n: number
    selected: Set<string>
  }

  let { n, selected = $bindable() }: Props = $props()
  const { engine } = getGazePlotterSession()

  const items = $derived(
    getAllParticipants(engine).map(p => ({ value: p.id.toString(), label: p.displayedName }))
  )
  const presets = $derived(
    participantSelectionPresets(engine).map(sel => ({
      id: sel.id,
      name: sel.name,
      members: sel.participantsIds.map(id => id.toString()),
    }))
  )
</script>

<SelectionStep
  {n}
  title="Choose participants"
  listTitle="Participants"
  noun="participant"
  {items}
  {presets}
  bind:selected
/>
