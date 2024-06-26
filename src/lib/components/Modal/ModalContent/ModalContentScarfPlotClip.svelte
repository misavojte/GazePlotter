<script lang="ts">
  import { getStimuliOrderVector } from '$lib/stores/dataStore.ts'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralFieldset from '$lib/components/General/GeneralFieldset/GeneralFieldset.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralInputNumber from '$lib/components/General/GeneralInput/GeneralInputNumber.svelte'
  import { addSuccessToast } from '$lib/stores/toastStore.js'

  import type { ScarfGridType } from '$lib/type/gridType.ts'
  import type { GridStoreType } from '$lib/stores/gridStore.ts'

  export let settings: ScarfGridType
  export let store: GridStoreType

  const allStimuliId = getStimuliOrderVector()

  let absoluteTimelineApply: 'this_stimulus' | 'all_stimuli' = 'this_stimulus'
  let ordinalTimelineApply: 'this_stimulus' | 'all_stimuli' = 'this_stimulus'

  let absoluteVal =
    settings.absoluteStimuliLastVal[settings.stimulusId] ??
    settings.absoluteGeneralLastVal
  let ordinalVal =
    settings.ordinalStimuliLastVal[settings.stimulusId] ??
    settings.ordinalGeneralLastVal

  const handleSubmit = () => {
    if (absoluteTimelineApply === 'this_stimulus') {
      settings.absoluteStimuliLastVal[settings.stimulusId] = absoluteVal
    } else {
      allStimuliId.forEach(stimulusId => {
        settings.absoluteStimuliLastVal[stimulusId] = absoluteVal
      })
    }
    if (ordinalTimelineApply === 'this_stimulus') {
      settings.ordinalStimuliLastVal[settings.stimulusId] = ordinalVal
    } else {
      allStimuliId.forEach(stimulusId => {
        settings.ordinalStimuliLastVal[stimulusId] = ordinalVal
      })
    }
    store.updateSettings(settings)
    addSuccessToast('Clipping values updated')
  }
</script>

<GeneralFieldset legend="Absolute timeline [ms]">
  <GeneralInputNumber
    label="Last value (0 = automatic)"
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
    label="Last value (0 = automatic)"
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
