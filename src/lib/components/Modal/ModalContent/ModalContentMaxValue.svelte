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

  let newMinValue = $state(settings.colorValueRange[0])
  let newMaxValue = $state(settings.colorValueRange[1])

  function handleConfirm() {
    settingsChange({
      colorValueRange: [newMinValue, newMaxValue],
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
