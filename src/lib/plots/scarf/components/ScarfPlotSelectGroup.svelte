<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import {
    getParticipantsGroups,
    data,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onDestroy } from 'svelte'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { handleScarfSelectionChange } from '../utils/scarfSelectService'

  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Use callback props instead of event dispatching
  let { settings, onWorkspaceCommand }: Props = $props()

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

    // Use the service to handle selection change with height calculation
    handleScarfSelectionChange(settings, { groupId }, onWorkspaceCommand)
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
