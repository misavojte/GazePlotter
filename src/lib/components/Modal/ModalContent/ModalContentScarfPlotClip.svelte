<script lang="ts">
  import { getStimuliOrderVector } from '$lib/stores/dataStore'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralFieldset from '$lib/components/General/GeneralFieldset/GeneralFieldset.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralInputNumber from '$lib/components/General/GeneralInput/GeneralInputNumber.svelte'
  import { addSuccessToast } from '$lib/stores/toastStore.js'
  import { modalStore } from '$lib/stores/modalStore.js'

  import type { ScarfGridType } from '$lib/type/gridType'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (newSettings: Partial<ScarfGridType>) => void
  }

  let { settings, store, settingsChange = () => {} }: Props = $props()

  const allStimuliId = getStimuliOrderVector()

  // Initialize with current values from settings
  let absoluteTimelineApply = $state<'this_stimulus' | 'all_stimuli'>(
    'this_stimulus'
  )
  let ordinalTimelineApply = $state<'this_stimulus' | 'all_stimuli'>(
    'this_stimulus'
  )

  // Make sure to initialize with actual values or defaults
  let absoluteVal = $state(
    settings.absoluteStimuliLastVal?.[settings.stimulusId] ??
      settings.absoluteGeneralLastVal ??
      0
  )

  let ordinalVal = $state(
    settings.ordinalStimuliLastVal?.[settings.stimulusId] ??
      settings.ordinalGeneralLastVal ??
      0
  )

  const handleAbsoluteValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    absoluteVal = +target.value
  }

  const handleOrdinalValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    ordinalVal = +target.value
  }

  const handleAbsoluteTimelineApplyChange = (
    value: 'this_stimulus' | 'all_stimuli'
  ) => {
    absoluteTimelineApply = value
  }

  const handleOrdinalTimelineApplyChange = (
    value: 'this_stimulus' | 'all_stimuli'
  ) => {
    ordinalTimelineApply = value
  }

  const handleSubmit = () => {
    // Create a new settings object to avoid direct mutation
    const newSettings = { ...settings }

    // Initialize arrays if they don't exist
    if (!Array.isArray(newSettings.absoluteStimuliLastVal)) {
      newSettings.absoluteStimuliLastVal = []
    }

    if (!Array.isArray(newSettings.ordinalStimuliLastVal)) {
      newSettings.ordinalStimuliLastVal = []
    }

    if (absoluteTimelineApply === 'this_stimulus') {
      newSettings.absoluteStimuliLastVal[settings.stimulusId] = absoluteVal
    } else {
      allStimuliId.forEach(stimulusId => {
        newSettings.absoluteStimuliLastVal[stimulusId] = absoluteVal
      })
    }

    if (ordinalTimelineApply === 'this_stimulus') {
      newSettings.ordinalStimuliLastVal[settings.stimulusId] = ordinalVal
    } else {
      allStimuliId.forEach(stimulusId => {
        newSettings.ordinalStimuliLastVal[stimulusId] = ordinalVal
      })
    }

    console.log('Updating settings with new values:', newSettings)

    // Update through the settingsChange function for component updates
    if (settingsChange) {
      settingsChange(newSettings)
    }

    addSuccessToast('Clipping values updated')

    // Close the modal after applying changes
    modalStore.close()
  }
</script>

<GeneralFieldset legend="Absolute timeline [ms]">
  <GeneralInputNumber
    label="Last value (0 = automatic)"
    value={absoluteVal}
    oninput={handleAbsoluteValChange}
  />
  <GeneralRadio
    options={[
      { value: 'this_stimulus', label: 'This stimulus' },
      { value: 'all_stimuli', label: 'All stimuli' },
    ]}
    legend="Apply to"
    userSelected={absoluteTimelineApply}
    onchange={handleAbsoluteTimelineApplyChange}
  />
</GeneralFieldset>
<GeneralFieldset legend="Ordinal timeline [indices]">
  <GeneralInputNumber
    label="Last value (0 = automatic)"
    value={ordinalVal}
    oninput={handleOrdinalValChange}
  />
  <GeneralRadio
    options={[
      { value: 'this_stimulus', label: 'This stimulus' },
      { value: 'all_stimuli', label: 'All stimuli' },
    ]}
    legend="Apply to"
    userSelected={ordinalTimelineApply}
    onchange={handleOrdinalTimelineApplyChange}
  />
</GeneralFieldset>
<MajorButton onclick={handleSubmit}>Apply</MajorButton>
