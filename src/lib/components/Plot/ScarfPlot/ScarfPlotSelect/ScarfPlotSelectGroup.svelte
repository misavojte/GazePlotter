<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getParticipantsGroups } from '$lib/stores/dataStore.ts'
  import { updateGroup } from '$lib/stores/scarfPlotsStore.ts'

  export let scarfId: number

  let value = '-1'

  const groups = getParticipantsGroups(true)

  const groupOptions = groups.map(group => {
    return {
      label: group.name,
      value: group.id.toString(),
    }
  })

  $: updateGroup(scarfId, parseInt(value))
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>
