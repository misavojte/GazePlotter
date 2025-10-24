<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    settings: TransitionMatrixGridType
    source: string,
    onWorkspaceCommand: (command: WorkspaceCommand) => void,
  }

  // Use callback props instead of event dispatching
  let { settings, source, onWorkspaceCommand }: Props = $props()

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

    // Create workspace command for settings change
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { stimulusId },
      source,
    })
  }
</script>

<Select
  label="Stimulus"
  options={stimuliOptions}
  value={selectedStimulusId}
  onchange={handleSelectChange}
  compact={true}
/>
