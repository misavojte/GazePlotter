<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getParticipantsGroups, data } from '$lib/stores/dataStore'
  import { onDestroy } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { getContext } from 'svelte'
  import type { GridStoreType } from '$lib/stores/gridStore'

  let store = getContext<GridStoreType>('gridStore')
  export let settings: ScarfGridType

  let value = settings.groupId.toString()
  let groupOptions: { value: string; label: string }[]

  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
  })

  $: fireChange(parseInt(value))

  const fireChange = (groupId: number) => {
    // Keep existing grid height for now
    const newSettings = { ...settings, groupId }
    store.updateSettings(newSettings)
  }

  onDestroy(() => {
    unsubscribe()
  })
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>
