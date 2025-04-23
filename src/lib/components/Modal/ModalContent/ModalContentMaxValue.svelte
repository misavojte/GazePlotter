<script lang="ts">
  import { modalStore } from '$lib/stores/modalStore'
  import NumberInput from '$lib/components/General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralInputColor from '$lib/components/General/GeneralInput/GeneralInputColor.svelte'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import { getStimuliOrderVector } from '$lib/stores/dataStore'
  import type { TransitionMatrixGridType } from '$lib/type/gridType'
  import GeneralInfoCallout from '$lib/components/General/GeneralInfoCallout/GeneralInfoCallout.svelte'

  interface Props {
    settings: TransitionMatrixGridType
    settingsChange: (newSettings: Partial<TransitionMatrixGridType>) => void
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
  const maxColorOptions = [
    { value: '#e0e0e0', label: 'Gray' },
    { value: '#cccccc', label: 'Light Gray' },
    { value: '#f0f0f0', label: 'Very Light Gray' },
    { value: '#ffffff', label: 'White' },
    {
      value:
        settings.colorScale?.length === 3
          ? settings.colorScale?.[2]
          : settings.colorScale?.[1],
      label: 'Scale Color',
    },
  ]

  const minColorOptions = [
    { value: '#e0e0e0', label: 'Gray' },
    { value: '#cccccc', label: 'Light Gray' },
    { value: '#f0f0f0', label: 'Very Light Gray' },
    { value: '#ffffff', label: 'White' },
    { value: settings.colorScale?.[0], label: 'Scale Color' },
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

  function handleBelowMinCustomColorChange(event: CustomEvent<string>) {
    belowMinColor = event.detail
  }

  function handleAboveMaxCustomColorChange(event: CustomEvent<string>) {
    aboveMaxColor = event.detail
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
    <GeneralInfoCallout
      title="Color Scale Cropping"
      paragraphs={[
        'Set the minimum and maximum values for the color scale.',
        'Setting consistent values across multiple matrices makes them directly comparable.',
      ]}
    />
  </div>

  <div class="input-container">
    <div class="section-header">Range Values</div>
    <div class="grid-layout">
      <div class="input-column">
        <NumberInput
          value={newMinValue}
          min={0}
          label="Minimum value"
          oninput={handleMinValueChange}
        />
      </div>
      <div class="input-column">
        <NumberInput
          value={newMaxValue}
          min={0}
          label="Maximum value (0 for auto)"
          oninput={handleMaxValueChange}
        />
      </div>
    </div>
    <div class="radio-wrapper">
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

    <div class="section-header">Values Outside Range</div>
    <div class="outside-range-settings">
      <div class="outside-range-section">
        <div class="section-title">Below Minimum:</div>
        <div class="color-selection">
          <div class="color-label">Color:</div>
          <div class="color-options">
            {#each minColorOptions as option}
              <button
                class="color-option"
                class:selected={belowMinColor === option.value}
                style="background-color: {option.value}"
                title={option.label}
                onclick={() => handleBelowMinColorChange(option.value)}
                aria-label={option.label}
              ></button>
            {/each}
            <GeneralInputColor
              label=""
              value={belowMinColor}
              width={120}
              oninput={handleBelowMinCustomColorChange}
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
            {#each maxColorOptions as option}
              <button
                class="color-option"
                class:selected={aboveMaxColor === option.value}
                style="background-color: {option.value}"
                title={option.label}
                onclick={() => handleAboveMaxColorChange(option.value)}
                aria-label={option.label}
              ></button>
            {/each}
            <GeneralInputColor
              label=""
              value={aboveMaxColor}
              width={120}
              oninput={handleAboveMaxCustomColorChange}
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
    max-width: 520px;
  }

  .description {
    margin-bottom: 1.5rem;
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

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .input-column {
    min-width: 0;
  }

  .radio-wrapper {
    margin-bottom: 1rem;
  }

  .outside-range-settings {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
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
    height: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .section-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    padding-bottom: 0.25rem;
  }

  .color-selection {
    margin-bottom: 0.5rem;
  }

  .color-label {
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .color-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.25rem 0;
    margin-bottom: 0.5rem;
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

  .radio-container {
    margin-top: 0.5rem;
  }

  .button-container {
    display: flex;
    margin-top: 1rem;
    gap: 0.5rem;
  }

  /* Media query for smaller screens */
  @media (max-width: 480px) {
    .grid-layout,
    .outside-range-settings {
      grid-template-columns: 1fr;
    }
  }
</style>
