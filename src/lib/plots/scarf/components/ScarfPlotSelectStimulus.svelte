<script lang="ts">
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import { handleScarfSelectionChange } from '$lib/plots/scarf/utils/scarfSelectService'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
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

    // Use the shared service to handle the change
    handleScarfSelectionChange(settings, { stimulusId }, settingsChange)
  }
</script>

<Select
  label="Stimulus"
  options={stimuliOptions}
  value={selectedStimulusId}
  onchange={handleSelectChange}
  compact={true}
/>
