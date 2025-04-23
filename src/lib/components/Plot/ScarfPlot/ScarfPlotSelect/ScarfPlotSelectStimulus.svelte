<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getStimuli } from '$lib/stores/dataStore.js'
  import { handleScarfSelectionChange } from '$lib/services/scarfSelectService'
  import type { ScarfGridType } from '$lib/type/gridType'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

  let selectedStimulusId = $state(settings.stimulusId.toString())

  // Update selectedStimulusId when settings change
  $effect(() => {
    selectedStimulusId = settings.stimulusId.toString()
  })

  /**
   * TODO: Make reactive in the future (when stimuli can be updated)
   */
  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })

  function handleSelectChange(event: CustomEvent) {
    const stimulusId = parseInt(event.detail)
    selectedStimulusId = stimulusId.toString()

    // Use the shared service to handle the change
    handleScarfSelectionChange(settings, { stimulusId }, settingsChange)
  }
</script>

<Select
  label="Stimulus"
  options={stimuliOption}
  value={selectedStimulusId}
  onchange={handleSelectChange}
  compact={true}
/>
