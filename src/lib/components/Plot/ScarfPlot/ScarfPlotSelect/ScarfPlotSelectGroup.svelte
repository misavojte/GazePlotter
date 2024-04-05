<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getParticipantsGroups, data } from '$lib/stores/dataStore.ts'
  import { onDestroy } from 'svelte'

  import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'
  export let settings: ScarfSettingsType

  let value = '-1'

  let groupOptions: { value: string; label: string }[]

  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
    console.log(groupOptions)
  })

  $: settings.groupId = parseInt(value)

  onDestroy(() => {
    unsubscribe()
  })
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>
