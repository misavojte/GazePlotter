<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'

  interface Props {
    settings: TransitionMatrixGridType
    settingsChange?: (settings: Partial<TransitionMatrixGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

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

    // Just update the stimulus ID without height calculations
    settingsChange({
      stimulusId,
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
