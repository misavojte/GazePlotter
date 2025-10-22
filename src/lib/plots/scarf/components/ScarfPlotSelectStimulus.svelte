<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { handleScarfSelectionChange } from '../utils/scarfSelectService'

  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Use callback props instead of event dispatching
  let { settings, onWorkspaceCommand }: Props = $props()

  let selectedStimulusId = $state(settings.stimulusId.toString())
  let stimuliOptions =
    $state<{ label: string; value: string }[]>(getStimuliOptions())

  // Update selectedStimulusId when settings change
  $effect(() => {
    selectedStimulusId = settings.stimulusId.toString()
    stimuliOptions = getStimuliOptions()
  })

  function handleSelectChange(event: CustomEvent) {
    const stimulusId = parseInt(event.detail)
    selectedStimulusId = stimulusId.toString()

    // Use the service to handle selection change with height calculation
    handleScarfSelectionChange(settings, { stimulusId }, onWorkspaceCommand)
  }
</script>

<Select
  label="Stimulus"
  options={stimuliOptions}
  value={selectedStimulusId}
  onchange={handleSelectChange}
  compact={true}
/>
