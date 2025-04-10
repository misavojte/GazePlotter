<script lang="ts">
  import { modalStore } from '$lib/stores/modalStore'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'

  interface Props {
    settings: AoiTransitionMatrixGridType
    settingsChange: (newSettings: Partial<AoiTransitionMatrixGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // Initialize with current color scale or default
  let colorPoints = $state<'two' | 'three'>(
    settings.colorScale?.length === 3 ? 'three' : 'two'
  )

  // Initialize colors with current values or defaults
  let colorOne = $state(settings.colorScale?.[0] || '#f7fbff')
  let colorTwo = $state(settings.colorScale?.[1] || '#08306b')
  let colorThree = $state(settings.colorScale?.[2] || '#08306b')

  // Color scale presets
  const presets = [
    {
      name: 'Blue',
      colors: ['#f7fbff', '#08306b'], // Light blue to dark blue
      description: 'Classic blue gradient (default)',
    },
    {
      name: 'Green to Red',
      colors: ['#31a354', '#f7fcb9', '#a50f15'], // dark green to light yellow to dark red
      description: 'Traffic light style (low to high)',
    },
    {
      name: 'Heat',
      colors: ['#fff5eb', '#fd8d3c', '#7f0000'], // White to orange to dark red
      description: 'Heat map style',
    },
  ]

  // Radio options for number of color points
  const colorPointOptions = [
    { value: 'two', label: '2 Colors (Min to Max)' },
    { value: 'three', label: '3 Colors (Min to Middle to Max)' },
  ]

  // Get current color scale based on settings
  const getCurrentColorScale = (): string[] => {
    return colorPoints === 'three'
      ? [colorOne, colorTwo, colorThree]
      : [colorOne, colorTwo]
  }

  // Preview gradient style
  const gradientStyle = $derived.by(() => {
    const colors = getCurrentColorScale()
    if (colors.length === 2) {
      return `linear-gradient(to right, ${colors[0]}, ${colors[1]})`
    } else {
      return `linear-gradient(to right, ${colors[0]}, ${colors[1]}, ${colors[2]})`
    }
  })

  // Handle preset selection
  function handlePresetSelect(preset: (typeof presets)[0]): void {
    if (preset.colors.length === 2) {
      colorPoints = 'two'
      colorOne = preset.colors[0]
      colorTwo = preset.colors[1]
    } else {
      colorPoints = 'three'
      colorOne = preset.colors[0]
      colorTwo = preset.colors[1]
      colorThree = preset.colors[2]
    }
  }

  // Handle gradient type change
  function handleGradientTypeChange(value: string): void {
    colorPoints = value as 'two' | 'three'
  }

  // Handle color changes
  function handleStartColorChange(event: Event): void {
    const input = event.target as HTMLInputElement
    colorOne = input.value
  }

  function handleMiddleColorChange(event: Event): void {
    const input = event.target as HTMLInputElement
    colorTwo = input.value
  }

  function handleEndColorChange(event: Event): void {
    const input = event.target as HTMLInputElement
    colorThree = input.value
  }

  // Apply changes and close modal
  function handleConfirm(): void {
    settingsChange({
      colorScale: getCurrentColorScale(),
    })
    modalStore.close()
  }

  // Close modal without changes
  function handleCancel(): void {
    modalStore.close()
  }
</script>

<div class="color-scale-modal">
  <div class="description">
    <p>
      Customize the color scale for visualization. The colors define how
      different transition values are displayed in the matrix.
    </p>
  </div>

  <div class="input-container">
    <div class="section-header">Gradient Type</div>
    <GeneralRadio
      options={colorPointOptions}
      userSelected={colorPoints}
      onchange={handleGradientTypeChange}
      legend="Color Points"
    />

    <div class="section-header">Color Selection</div>
    <div class="color-inputs">
      <div class="color-input">
        <label for="colorOne">Min Value Color</label>
        <input
          type="color"
          id="colorOne"
          value={colorOne}
          oninput={handleStartColorChange}
        />
      </div>

      <div class="color-input">
        <label for="colorTwo"
          >{colorPoints === 'three'
            ? 'Middle Value Color'
            : 'Max Value Color'}</label
        >
        <input
          type="color"
          id="colorTwo"
          value={colorTwo}
          oninput={handleMiddleColorChange}
        />
      </div>

      {#if colorPoints === 'three'}
        <div class="color-input">
          <label for="colorThree">Max Value Color</label>
          <input
            type="color"
            id="colorThree"
            value={colorThree}
            oninput={handleEndColorChange}
          />
        </div>
      {/if}
    </div>

    <div class="preview-section">
      <label>Preview:</label>
      <div class="gradient-preview" style:background={gradientStyle}></div>
    </div>

    <div class="section-header">Presets</div>
    <div class="presets-container">
      {#each presets as preset}
        <button
          class="preset-button"
          onclick={() => handlePresetSelect(preset)}
        >
          <div class="preset-header">
            <span class="preset-name">{preset.name}</span>
          </div>
          <div
            class="preset-preview"
            style:background={preset.colors.length === 2
              ? `linear-gradient(to right, ${preset.colors[0]}, ${preset.colors[1]})`
              : `linear-gradient(to right, ${preset.colors[0]}, ${preset.colors[1]}, ${preset.colors[2]})`}
          ></div>
          <div class="preset-description">{preset.description}</div>
        </button>
      {/each}
    </div>
  </div>

  <div class="button-container">
    <GeneralButtonMajor onclick={handleCancel}>Cancel</GeneralButtonMajor>
    <GeneralButtonMajor onclick={handleConfirm}>Apply</GeneralButtonMajor>
  </div>
</div>

<style>
  .color-scale-modal {
    padding: 1rem;
    max-width: 450px;
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

  .color-inputs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .color-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .color-input label {
    font-size: 0.9rem;
  }

  .color-input input[type='color'] {
    width: 100%;
    height: 40px;
    padding: 0;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
  }

  .preview-section {
    margin: 1rem 0;
  }

  .gradient-preview {
    height: 40px;
    border-radius: 4px;
    margin-top: 0.5rem;
    border: 1px solid #ddd;
  }

  .presets-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .preset-button {
    display: flex;
    flex-direction: column;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.5rem;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .preset-header {
    margin-bottom: 0.5rem;
  }

  .preset-name {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .preset-preview {
    height: 30px;
    border-radius: 3px;
    margin-bottom: 0.5rem;
  }

  .preset-description {
    font-size: 0.8rem;
    color: #666;
  }

  .button-container {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
