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

  // Setup state for display options
  let belowMinColor = $state(settings.belowMinColor || '#e0e0e0')
  let aboveMaxColor = $state(settings.aboveMaxColor || '#e0e0e0')
  let showBelowMinLabels = $state(settings.showBelowMinLabels ? 'show' : 'hide')
  let showAboveMaxLabels = $state(settings.showAboveMaxLabels ? 'show' : 'hide')

  // Options for show/hide radio buttons
  const visibilityOptions = [
    { value: 'show', label: 'Show labels' },
    { value: 'hide', label: 'Hide labels' },
  ]

  // Predefined color options
  const colorOptions = [
    { value: '#e0e0e0', label: 'Gray' },
    { value: '#cccccc', label: 'Light Gray' },
    { value: '#f0f0f0', label: 'Very Light Gray' },
    { value: '#ffffff', label: 'White' },
    { value: '#f8e0e0', label: 'Light Red' },
    { value: '#e0f8e0', label: 'Light Green' },
  ]

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
      belowMinColor,
      aboveMaxColor,
      showBelowMinLabels: showBelowMinLabels === 'show',
      showAboveMaxLabels: showAboveMaxLabels === 'show',
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

  function handleBelowMinColorChange(value: string) {
    belowMinColor = value
  }

  function handleAboveMaxColorChange(value: string) {
    aboveMaxColor = value
  }

  function handleBelowMinLabelsChange(value: string) {
    showBelowMinLabels = value
  }

  function handleAboveMaxLabelsChange(value: string) {
    showAboveMaxLabels = value
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
    <div class="section-header">Range Values</div>
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

    <div class="section-header">Values Outside Range</div>
    <div class="outside-range-settings">
      <div class="outside-range-section">
        <div class="section-title">Below Minimum:</div>
        <div class="color-selection">
          <div class="color-label">Color:</div>
          <div class="color-options">
            {#each colorOptions as option}
              <button
                class="color-option"
                class:selected={belowMinColor === option.value}
                style="background-color: {option.value}"
                title={option.label}
                on:click={() => handleBelowMinColorChange(option.value)}
              ></button>
            {/each}
            <input
              type="color"
              value={belowMinColor}
              on:input={e => handleBelowMinColorChange(e.currentTarget.value)}
              title="Custom color"
              class="color-picker"
            />
          </div>
        </div>
        <div class="radio-container">
          <GeneralRadio
            options={visibilityOptions}
            legend="Label Visibility"
            userSelected={showBelowMinLabels}
            onchange={handleBelowMinLabelsChange}
          />
        </div>
      </div>

      <div class="outside-range-section">
        <div class="section-title">Above Maximum:</div>
        <div class="color-selection">
          <div class="color-label">Color:</div>
          <div class="color-options">
            {#each colorOptions as option}
              <button
                class="color-option"
                class:selected={aboveMaxColor === option.value}
                style="background-color: {option.value}"
                title={option.label}
                on:click={() => handleAboveMaxColorChange(option.value)}
              ></button>
            {/each}
            <input
              type="color"
              value={aboveMaxColor}
              on:input={e => handleAboveMaxColorChange(e.currentTarget.value)}
              title="Custom color"
              class="color-picker"
            />
          </div>
        </div>
        <div class="radio-container">
          <GeneralRadio
            options={visibilityOptions}
            legend="Label Visibility"
            userSelected={showAboveMaxLabels}
            onchange={handleAboveMaxLabelsChange}
          />
        </div>
      </div>
    </div>
  </div>

  <div class="button-container">
    <GeneralButtonMajor onclick={handleCancel}>Cancel</GeneralButtonMajor>
    <GeneralButtonMajor onclick={handleConfirm}>Apply</GeneralButtonMajor>
  </div>
</div>

<style>
  .value-range-modal {
    padding: 1rem;
    max-width: 450px;
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

  .section-header {
    font-weight: 600;
    margin: 1.5rem 0 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #eaeaea;
  }

  .outside-range-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .outside-range-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: #f9f9f9;
    border-radius: 4px;
  }

  .section-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .color-selection {
    margin-bottom: 0.5rem;
  }

  .color-label {
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
  }

  .color-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .color-option {
    width: 24px;
    height: 24px;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
  }

  .color-option.selected {
    border: 2px solid #000;
    box-shadow:
      0 0 0 1px #fff,
      0 0 0 3px #666;
  }

  .color-picker {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
  }

  .radio-container {
    margin-top: 0.5rem;
  }

  .button-container {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
