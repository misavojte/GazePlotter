<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import {
    getParticipantsGroups,
    data,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onDestroy } from 'svelte'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'

  interface Props {
    settings: TransitionMatrixGridType
    settingsChange?: (settings: Partial<TransitionMatrixGridType>) => void
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

    // Just update the group ID without height calculations
    settingsChange({
      groupId,
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
