<script lang="ts">
  import { getStimuliOrderVector } from '$lib/data/engine'
  import GeneralFieldset from '$lib/shared/components/GeneralFieldset.svelte'
  import GeneralRadio from '$lib/shared/components/GeneralRadio.svelte'
  import GeneralInputNumber from '$lib/shared/components/GeneralInputNumber.svelte'
  import { ModalButtons, IntroductoryParagraph, modalState } from '$lib/modals'

  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { UpdateSettingsCommand } from '$lib/workspace/commands'

  interface Props {
    settings: AoiStreamPlotGridType
    source: string
    onWorkspaceCommand: (command: UpdateSettingsCommand) => void
  }

  let { settings, source, onWorkspaceCommand }: Props = $props()

  const allStimuliId = getStimuliOrderVector()

  // Initialize with current values from settings
  let timelineApply = $state<'this_stimulus' | 'all_stimuli'>('this_stimulus')

  // Initialize start and end values
  let startVal = $state(
    settings.absoluteStimuliLimits?.[settings.stimulusId]?.[0] ?? 0
  )

  let endVal = $state(
    settings.absoluteStimuliLimits?.[settings.stimulusId]?.[1] ?? 0
  )

  const handleStartValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    startVal = +target.value
  }

  const handleEndValChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    endVal = +target.value
  }

  const handleTimelineApplyChange = (value: string) => {
    timelineApply = value as 'this_stimulus' | 'all_stimuli'
  }

  const handleSubmit = () => {
    // Create a new settings object to avoid direct mutation
    const newSettings = { ...settings }

    // Initialize array if it doesn't exist
    if (!Array.isArray(newSettings.absoluteStimuliLimits)) {
      newSettings.absoluteStimuliLimits = []
    }

    if (timelineApply === 'this_stimulus') {
      newSettings.absoluteStimuliLimits[settings.stimulusId] = [
        startVal,
        endVal,
      ]
    } else {
      // Apply to all stimuli
      allStimuliId.forEach(stimulusId => {
        newSettings.absoluteStimuliLimits[stimulusId] = [startVal, endVal]
      })
    }

    // Update through the workspace command system
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: newSettings,
      source,
    })

    // Close the modal after applying changes
    modalState.close()
  }

  const handleCancel = () => {
    modalState.close()
  }
</script>

<IntroductoryParagraph
  maxWidth="400px"
  paragraphs={[
    'Set custom time ranges for Time-binned AOI Occupancy visualization. Clip the timeline to focus on specific intervals for better analysis.',
  ]}
/>

<GeneralFieldset legend="Timeline clipping [ms]">
  <GeneralInputNumber
    label="Start value (0 = beginning of timeline)"
    value={startVal}
    oninput={handleStartValChange}
  />
  <GeneralInputNumber
    label="End value (0 = automatic)"
    value={endVal}
    oninput={handleEndValChange}
  />
  <GeneralRadio
    options={[
      { value: 'this_stimulus', label: 'This stimulus' },
      { value: 'all_stimuli', label: 'All stimuli' },
    ]}
    legend="Apply to"
    userSelected={timelineApply}
    onchange={handleTimelineApplyChange}
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
