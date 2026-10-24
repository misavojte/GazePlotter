<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { getParticipants } from '$lib/data/engine'
  import SelectionStep from './SelectionStep.svelte'
  import { participantGroupPresets } from './participants'

  /** The participant step every export modal shares: SelectionStep fed with
   *  participants and their saved selections. */
  interface Props {
    n: number
    selected: Set<string>
  }

  let { n, selected = $bindable() }: Props = $props()
  const { engine } = getGazePlotterSession()

  const items = $derived(
    getParticipants(engine, -1).map(p => ({ value: p.id.toString(), label: p.displayedName }))
  )
  const presets = $derived(
    participantGroupPresets(engine).map(group => ({
      id: group.id,
      name: group.name,
      members: group.participantsIds.map(id => id.toString()),
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
