<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { handleScarfSelectionChange } from '../utils/scarfSelectService'

  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Use callback props instead of event dispatching
  let { settings, onWorkspaceCommand }: Props = $props()

  // Track selected timeline
  let selectedTimeline = $state(settings.timeline)

  // Update selectedTimeline when settings change
  $effect(() => {
    selectedTimeline = settings.timeline
  })

  const timelineOptions = [
    { value: 'absolute', label: 'Absolute' },
    { value: 'relative', label: 'Relative' },
    { value: 'ordinal', label: 'Ordinal' },
  ]

  // Handle timeline change
  function handleTimelineChange(event: CustomEvent) {
    const timeline = event.detail as 'absolute' | 'relative' | 'ordinal'
    selectedTimeline = timeline

    // Use the service to handle selection change with height calculation
    handleScarfSelectionChange(settings, { timeline }, onWorkspaceCommand)
  }
</script>

<Select
  label="Timeline"
  options={timelineOptions}
  value={selectedTimeline}
  onchange={handleTimelineChange}
  compact={true}
/>
