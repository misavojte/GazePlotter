<script lang="ts">
  import { run } from 'svelte/legacy';

  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import {
    getParticipantsGroups,
    data,
    hasStimulusAoiVisibility,
  } from '$lib/stores/dataStore'
  import { onDestroy } from 'svelte'
  import {
    getDynamicAoiBoolean,
    getScarfGridHeightFromCurrentData,
  } from '$lib/services/scarfServices'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { getContext } from 'svelte'
  import type { GridStoreType } from '$lib/stores/gridStore'
  let store = getContext<GridStoreType>('gridStore')
  interface Props {
    settings: ScarfGridType;
  }

  let { settings }: Props = $props();
  let value = $state(settings.groupId.toString())

  let groupOptions: { value: string; label: string }[] = $state()

  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
    console.log(groupOptions)
  })


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
  run(() => {
    fireChange(parseInt(value))
  });
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>
