<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getStimuli } from '$lib/stores/dataStore.js'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'

  interface Props {
    settings: AoiTransitionMatrixGridType
    settingsChange?: (settings: Partial<AoiTransitionMatrixGridType>) => void
  }
  a

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

  let selectedStimulusId = $state(settings.stimulusId.toString())

  // Update selectedStimulusId when settings change
  $effect(() => {
    selectedStimulusId = settings.stimulusId.toString()
  })

  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
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
  options={stimuliOption}
  value={selectedStimulusId}
  onchange={handleSelectChange}
  compact={true}
/>
