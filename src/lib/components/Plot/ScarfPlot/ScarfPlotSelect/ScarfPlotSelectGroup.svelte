<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getParticipantsGroups, data } from '$lib/stores/dataStore.ts'
  import { updateGroup } from '$lib/stores/scarfPlotsStore.ts'
  import { onDestroy } from 'svelte'

  export let scarfId: number

  let value = '-1'

  let groupOptions: { value: string; label: string }[]

  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
    console.log(groupOptions)
  })

  $: updateGroup(scarfId, parseInt(value))

  onDestroy(() => {
    unsubscribe()
  })
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>
