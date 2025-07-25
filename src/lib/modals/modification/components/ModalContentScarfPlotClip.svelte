<script lang="ts">
  import { getStimuliOrderVector } from '$lib/gaze-data/front-process/stores/dataStore'
  import GeneralFieldset from '$lib/shared/components/GeneralFieldset.svelte'
  import GeneralRadio from '$lib/shared/components/GeneralRadio.svelte'
  import GeneralInputNumber from '$lib/shared/components/GeneralInputNumber.svelte'
  import { ModalButtons, IntroductoryParagraph } from '$lib/modals'
  import { addSuccessToast } from '$lib/toaster'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'

  import type { ScarfGridType } from '$lib/workspace/type/gridType'

  interface Props {
    settings: ScarfGridType
    settingsChange: (newSettings: Partial<ScarfGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  const allStimuliId = getStimuliOrderVector()

  // Initialize with current values from settings
  let absoluteTimelineApply = $state<'this_stimulus' | 'all_stimuli'>(
    'this_stimulus'
  )
  let ordinalTimelineApply = $state<'this_stimulus' | 'all_stimuli'>(
    'this_stimulus'
  )

  // Initialize start and end values for both timeline types
  let absoluteStartVal = $state(
    settings.absoluteStimuliLimits?.[settings.stimulusId]?.[0] ?? 0
  )

  let absoluteEndVal = $state(
    settings.absoluteStimuliLimits?.[settings.stimulusId]?.[1] ?? 0
  )

  let ordinalStartVal = $state(
    settings.ordinalStimuliLimits?.[settings.stimulusId]?.[0] ?? 0
  )

  let ordinalEndVal = $state(
    settings.ordinalStimuliLimits?.[settings.stimulusId]?.[1] ?? 0
  )

  const handleAbsoluteStartValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    absoluteStartVal = +target.value
  }

  const handleAbsoluteEndValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    absoluteEndVal = +target.value
  }

  const handleOrdinalStartValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    ordinalStartVal = +target.value
  }

  const handleOrdinalEndValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    ordinalEndVal = +target.value
  }

  const handleAbsoluteTimelineApplyChange = (value: string) => {
    absoluteTimelineApply = value as 'this_stimulus' | 'all_stimuli'
  }

  const handleOrdinalTimelineApplyChange = (value: string) => {
    ordinalTimelineApply = value as 'this_stimulus' | 'all_stimuli'
  }

  const handleSubmit = () => {
    // Create a new settings object to avoid direct mutation
    const newSettings = { ...settings }

    // Initialize arrays if they don't exist
    if (!Array.isArray(newSettings.absoluteStimuliLimits)) {
      newSettings.absoluteStimuliLimits = []
    }

    if (!Array.isArray(newSettings.ordinalStimuliLimits)) {
      newSettings.ordinalStimuliLimits = []
    }

    if (absoluteTimelineApply === 'this_stimulus') {
      newSettings.absoluteStimuliLimits[settings.stimulusId] = [
        absoluteStartVal,
        absoluteEndVal,
      ]
    } else {
      // Apply to all stimuli
      allStimuliId.forEach(stimulusId => {
        newSettings.absoluteStimuliLimits[stimulusId] = [
          absoluteStartVal,
          absoluteEndVal,
        ]
      })
    }

    if (ordinalTimelineApply === 'this_stimulus') {
      newSettings.ordinalStimuliLimits[settings.stimulusId] = [
        ordinalStartVal,
        ordinalEndVal,
      ]
    } else {
      // Apply to all stimuli
      allStimuliId.forEach(stimulusId => {
        newSettings.ordinalStimuliLimits[stimulusId] = [
          ordinalStartVal,
          ordinalEndVal,
        ]
      })
    }

    // Update through the settingsChange function for component updates
    if (settingsChange) {
      settingsChange(newSettings)
    }

    addSuccessToast('Timeline range updated')

    // Close the modal after applying changes
    modalStore.close()
  }

  const handleCancel = () => {
    modalStore.close()
  }
</script>

<IntroductoryParagraph
  maxWidth="400px"
  paragraphs={[
    'Set custom time ranges for scarf plot visualization. Clip the timeline to focus on specific intervals for better analysis.',
  ]}
/>

<GeneralFieldset legend="Absolute timeline [ms]">
  <GeneralInputNumber
    label="Start value (0 = beginning of timeline)"
    value={absoluteStartVal}
    oninput={handleAbsoluteStartValChange}
  />
  <GeneralInputNumber
    label="End value (0 = automatic)"
    value={absoluteEndVal}
    oninput={handleAbsoluteEndValChange}
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
    label="Start value (0 = beginning of timeline)"
    value={ordinalStartVal}
    oninput={handleOrdinalStartValChange}
  />
  <GeneralInputNumber
    label="End value (0 = automatic)"
    value={ordinalEndVal}
    oninput={handleOrdinalEndValChange}
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
<ModalButtons
  buttons={[
    {
      label: 'Apply',
      onclick: handleSubmit,
      variant: 'primary',
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
    },
  ]}
/>
