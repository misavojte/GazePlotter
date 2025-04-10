<script lang="ts">
  import { modalStore } from '$lib/stores/modalStore'
  import NumberInput from '$lib/components/General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import { getStimuliOrderVector } from '$lib/stores/dataStore'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'

  interface Props {
    settings: AoiTransitionMatrixGridType
    settingsChange: (newSettings: Partial<AoiTransitionMatrixGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  const allStimuliId = getStimuliOrderVector()
  const currentStimulusId = settings.stimulusId

  // Get current stimulus-specific range or use defaults
  let newMinValue = $state(
    settings.stimuliColorValueRanges[currentStimulusId]?.[0] ?? 0
  )
  let newMaxValue = $state(
    settings.stimuliColorValueRanges[currentStimulusId]?.[1] ?? 0
  )

  let rangeApply = $state<'this_stimulus' | 'all_stimuli'>('this_stimulus')

  function handleConfirm() {
    // Ensure stimuliColorValueRanges is initialized properly
    const stimuliColorValueRanges = [
      ...(settings.stimuliColorValueRanges || []),
    ]

    if (rangeApply === 'this_stimulus') {
      // Apply to current stimulus only
      stimuliColorValueRanges[currentStimulusId] = [newMinValue, newMaxValue]
    } else {
      // Apply to all stimuli
      allStimuliId.forEach(stimulusId => {
        stimuliColorValueRanges[stimulusId] = [newMinValue, newMaxValue]
      })
    }

    settingsChange({
      stimuliColorValueRanges,
    })
    modalStore.close()
  }

  function handleCancel() {
    modalStore.close()
  }

  function handleMinValueChange(event: Event) {
    const target = event.target as HTMLInputElement
    newMinValue = target.valueAsNumber
  }

  function handleMaxValueChange(event: Event) {
    const target = event.target as HTMLInputElement
    newMaxValue = target.valueAsNumber
  }

  function handleRangeApplyChange(value: string) {
    rangeApply = value as 'this_stimulus' | 'all_stimuli'
  }
</script>

<div class="value-range-modal">
  <div class="description">
    <p>
      Set the minimum and maximum values for the color scale. This affects how
      transitions are colored in the matrix.
    </p>
    <p class="note">
      Setting consistent values across multiple matrices makes them directly
      comparable.
    </p>
  </div>

  <div class="input-container">
    <div class="number-input">
      <NumberInput
        value={newMinValue}
        min={0}
        label="Minimum value"
        oninput={handleMinValueChange}
      />
    </div>
    <div class="number-input">
      <NumberInput
        value={newMaxValue}
        min={0}
        label="Maximum value (0 for auto)"
        oninput={handleMaxValueChange}
      />
    </div>
    <GeneralRadio
      options={[
        { value: 'this_stimulus', label: 'This stimulus' },
        { value: 'all_stimuli', label: 'All stimuli' },
      ]}
      legend="Apply to"
      userSelected={rangeApply}
      onchange={handleRangeApplyChange}
    />
  </div>

  <div class="button-container">
    <GeneralButtonMajor onclick={handleCancel}>Cancel</GeneralButtonMajor>
    <GeneralButtonMajor onclick={handleConfirm}>Apply</GeneralButtonMajor>
  </div>
</div>

<style>
  .value-range-modal {
    padding: 1rem;
    max-width: 400px;
  }

  .description {
    margin-bottom: 1.5rem;
  }

  .note {
    font-style: italic;
    font-size: 0.9em;
    opacity: 0.8;
  }

  .input-container {
    margin-bottom: 1.5rem;
  }

  .button-container {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
