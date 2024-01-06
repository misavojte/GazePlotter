<script lang="ts">
  import {
    getScarfPlotState,
    getStimulusId,
    getStimulusLastValue,
    scarfPlotStates,
    updateStimulusLastValue,
  } from '$lib/stores/scarfPlotsStore.ts'
  import { getStimuliOrderVector } from '$lib/stores/dataStore.ts'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralFieldset from '$lib/components/General/GeneralFieldset/GeneralFieldset.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralInputNumber from '$lib/components/General/GeneralInput/GeneralInputNumber.svelte'
  import { addSuccessToast } from '$lib/stores/toastStore.js'

  export let scarfId: number
  const scarfState = getScarfPlotState($scarfPlotStates, scarfId)
  if (!scarfState) throw new Error('Invalid scarfId')
  const stimulusId = getStimulusId(scarfId)
  const allStimuliId = getStimuliOrderVector()

  let absoluteTimelineApply: 'this_stimulus' | 'all_stimuli' = 'this_stimulus'
  let ordinalTimelineApply: 'this_stimulus' | 'all_stimuli' = 'this_stimulus'

  let absoluteVal = getStimulusLastValue(scarfId, stimulusId, 'absolute')
  let ordinalVal = getStimulusLastValue(scarfId, stimulusId, 'ordinal')

  const handleSubmit = () => {
    if (absoluteTimelineApply === 'this_stimulus') {
      updateStimulusLastValue(scarfId, stimulusId, absoluteVal, 'absolute')
    } else {
      allStimuliId.forEach(stimulusId => {
        updateStimulusLastValue(scarfId, stimulusId, absoluteVal, 'absolute')
      })
    }
    if (ordinalTimelineApply === 'this_stimulus') {
      updateStimulusLastValue(scarfId, stimulusId, ordinalVal, 'ordinal')
    } else {
      allStimuliId.forEach(stimulusId => {
        updateStimulusLastValue(scarfId, stimulusId, ordinalVal, 'ordinal')
      })
    }
    addSuccessToast('Clipping values updated')
  }
</script>

<GeneralFieldset legend="Absolute timeline [ms]">
  <GeneralInputNumber
    legend="Last value (0 = automatic)"
    bind:value={absoluteVal}
  />
  <GeneralRadio
    options={[
      { value: 'this_stimulus', label: 'This stimulus' },
      { value: 'all_stimuli', label: 'All stimuli' },
    ]}
    legend="Apply to"
    bind:userSelected={absoluteTimelineApply}
  />
</GeneralFieldset>
<GeneralFieldset legend="Ordinal timeline [indices]">
  <GeneralInputNumber
    legend="Last value (0 = automatic)"
    bind:value={ordinalVal}
  />
  <GeneralRadio
    options={[
      { value: 'this_stimulus', label: 'This stimulus' },
      { value: 'all_stimuli', label: 'All stimuli' },
    ]}
    legend="Apply to"
    bind:userSelected={ordinalTimelineApply}
  />
</GeneralFieldset>
<MajorButton on:click={handleSubmit}>Apply</MajorButton>
