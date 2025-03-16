<script lang="ts">
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

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

  // Track selected group
  let selectedGroupId = $state(settings.groupId.toString())

  // Update selectedGroupId when settings change
  $effect(() => {
    selectedGroupId = settings.groupId.toString()
  })

  let groupOptions: { value: string; label: string }[] = $state([])

  // Subscribe to data changes to update group options
  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
  })

  // Handle group change
  function handleGroupChange(event: CustomEvent) {
    const groupId = parseInt(event.detail)
    selectedGroupId = groupId.toString()

    // Calculate new height based on selected group
    const h = getScarfGridHeightFromCurrentData(
      settings.stimulusId,
      getDynamicAoiBoolean(
        settings.timeline,
        settings.dynamicAOI,
        hasStimulusAoiVisibility(settings.stimulusId)
      ),
      groupId
    )

    // Call the callback prop with the updated settings
    settingsChange({
      groupId,
      h,
    })
  }

  onDestroy(() => {
    unsubscribe()
  })
</script>

<Select
  label="Group"
  options={groupOptions}
  value={selectedGroupId}
  onchange={handleGroupChange}
  compact={true}
/>
