<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import {
    getParticipantsGroups,
    data,
    hasStimulusAoiVisibility,
  } from '$lib/stores/dataStore.ts'
  import { onDestroy } from 'svelte'
  import {
    getDynamicAoiBoolean,
    getScarfGridHeightFromCurrentData,
  } from '$lib/services/scarfServices.ts'
  import type { ScarfGridType } from '$lib/type/gridType.ts'
  import { getContext } from 'svelte'
  import type { GridStoreType } from '$lib/stores/gridStore.ts'
  let store = getContext<GridStoreType>('gridStore')
  export let settings: ScarfGridType
  let value = settings.groupId.toString()

  let groupOptions: { value: string; label: string }[]

  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
    console.log(groupOptions)
  })

  $: fireChange(parseInt(value))

  const fireChange = (groupId: number) => {
    const h = getScarfGridHeightFromCurrentData(
      settings.stimulusId,
      getDynamicAoiBoolean(
        settings.timeline,
        settings.dynamicAOI,
        hasStimulusAoiVisibility(settings.stimulusId)
      ),
      groupId
    )
    const newSettings = { ...settings, groupId, h }
    store.updateSettings(newSettings)
  }

  onDestroy(() => {
    unsubscribe()
  })
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>
