<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { handleScarfSelectionChange } from '$lib/services/scarfSelectService'
  import type { ScarfGridType } from '$lib/type/gridType'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

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

    // Use the shared service to handle the change
    handleScarfSelectionChange(settings, { timeline }, settingsChange)
  }
</script>

<Select
  label="Timeline"
  options={timelineOptions}
  value={selectedTimeline}
  onchange={handleTimelineChange}
  compact={true}
/>
