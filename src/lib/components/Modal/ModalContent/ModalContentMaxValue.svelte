<script lang="ts">
  import { modalStore } from '$lib/stores/modalStore'
  import NumberInput from '$lib/components/General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'

  interface Props {
    settings: AoiTransitionMatrixGridType
    settingsChange: (newSettings: Partial<AoiTransitionMatrixGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  let newMaxValue = $state(settings.colorValueRange[1])
  let useAutoValue = $state(settings.colorValueRange[1] === 0)

  function handleConfirm() {
    // When auto is selected, use 0 to indicate auto calculation
    settingsChange({
      colorValueRange: useAutoValue ? [0, 0] : [0, newMaxValue],
    })
    modalStore.close()
  }

  function handleCancel() {
    modalStore.close()
  }

  function toggleAutoValue(value: boolean) {
    useAutoValue = value
    if (useAutoValue) {
      newMaxValue = settings.colorValueRange[1]
    }
  }

  function handleValueChange(event: Event) {
    const target = event.target as HTMLInputElement
    newMaxValue = target.valueAsNumber
  }
</script>

<div class="max-value-modal">
  <div class="description">
    <p>
      Set the maximum value for the color scale. This affects how transitions
      are colored in the matrix.
    </p>
    <p class="note">
      Setting a consistent maximum value across multiple matrices makes them
      directly comparable.
    </p>
  </div>

  <div class="input-container">
    <div class="radio-group">
      <label>
        <input
          type="radio"
          name="valueMode"
          checked={!useAutoValue}
          onchange={() => toggleAutoValue(false)}
        />
        <span>Custom value</span>
      </label>
      <label>
        <input
          type="radio"
          name="valueMode"
          checked={useAutoValue}
          onchange={() => toggleAutoValue(true)}
        />
        <span>Auto (calculated from data's max value)</span>
      </label>
    </div>

    <div class="number-input" class:disabled={useAutoValue}>
      <NumberInput
        value={newMaxValue}
        min={1}
        label="Maximum value"
        oninput={useAutoValue ? undefined : handleValueChange}
      />
    </div>
  </div>

  <div class="button-container">
    <GeneralButtonMajor onclick={handleCancel}>Cancel</GeneralButtonMajor>
    <GeneralButtonMajor onclick={handleConfirm}>Apply</GeneralButtonMajor>
  </div>
</div>

<style>
  .max-value-modal {
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

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .radio-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .number-input.disabled {
    opacity: 0.5;
  }

  .button-container {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
