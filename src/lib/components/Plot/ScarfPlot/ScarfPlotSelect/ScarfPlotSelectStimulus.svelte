<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import {
    getStimuli,
    hasStimulusAoiVisibility,
  } from '$lib/stores/dataStore.js'
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

    const h = getScarfGridHeightFromCurrentData(
      stimulusId,
      getDynamicAoiBoolean(
        settings.timeline,
        settings.dynamicAOI,
        hasStimulusAoiVisibility(stimulusId)
      ),
      settings.groupId
    )

    // Call the callback prop with the updated settings
    if (settingsChange) {
      settingsChange({
        stimulusId,
        h,
      })
    }
  }
</script>

<Select
  label="Stimulus"
  options={stimuliOption}
  value={selectedStimulusId}
  onchange={handleSelectChange}
  compact={true}
/>
