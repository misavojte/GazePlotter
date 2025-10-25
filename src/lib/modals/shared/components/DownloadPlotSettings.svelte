<script lang="ts">
  import {
    GeneralInputNumber,
    GeneralSelect,
    GeneralInputText,
    GeneralButtonPreset,
  } from '$lib/shared/components'
  import { SectionHeader } from '$lib/modals'

  // Define the props interface
  interface Props {
    typeOfExport: '.svg' | '.png' | '.jpg' | '.webp'
    width: number
    fileName: string
    dpi: number
    marginTop: number
    marginRight: number
    marginBottom: number
    marginLeft: number
  }

  // Declare props with defaults and mark them as bindable
  let {
    typeOfExport = $bindable(),
    width = $bindable(),
    fileName = $bindable(),
    dpi = $bindable(),
    marginTop = $bindable(),
    marginRight = $bindable(),
    marginBottom = $bindable(),
    marginLeft = $bindable(),
  }: Props = $props()

  // Check if DPI should be enabled (only for canvas-based formats)
  const isDpiEnabled = $derived(typeOfExport !== '.svg')

  // Common DPI presets
  const dpiPresets = [
    { value: 96, label: '96 DPI (Screen)' },
    { value: 150, label: '150 DPI (Medium)' },
    { value: 300, label: '300 DPI (Print)' },
    { value: 600, label: '600 DPI (High Quality)' },
  ]

  // Available export options
  const options = [
    { label: 'PNG', value: '.png' },
    { label: 'JPG', value: '.jpg' },
  ]

  // Function to set all margins at once
  function setAllMargins(value: number) {
    marginTop = value
    marginRight = value
    marginBottom = value
    marginLeft = value
  }

  // Function to set DPI to a preset value
  function setDpi(value: number) {
    dpi = value
  }
</script>

<div class="settings-section">
  <SectionHeader text="Export Settings" />
  <div class="settings-grid-main">
    <div class="settings-item">
      <GeneralInputNumber label="Width in px" bind:value={width} />
    </div>
    <div class="settings-item">
      <GeneralSelect
        label="Output file type"
        {options}
        bind:value={typeOfExport}
      />
    </div>
    <div class="settings-item">
      <GeneralInputText label="Output file name" bind:value={fileName} />
    </div>

    <!-- DPI Settings -->
    <div class="settings-item">
      <div class="dpi-container" class:disabled={!isDpiEnabled}>
        <GeneralInputNumber
          label="DPI (Resolution)"
          bind:value={dpi}
          min={72}
          disabled={!isDpiEnabled}
        />
      </div>
    </div>
  </div>

  <!-- DPI Presets -->
  {#if isDpiEnabled}
    <div class="dpi-presets">
      <span class="presets-label">DPI Presets:</span>
      {#each dpiPresets as preset}
        <GeneralButtonPreset
          label={preset.label}
          isActive={dpi === preset.value}
          onclick={() => setDpi(preset.value)}
        />
      {/each}
    </div>
  {/if}

  <!-- Margin Settings -->
  <div class="margin-settings">
    <SectionHeader text="Margins" />
    <p class="margin-explanation">
      Margins control the spacing around your plot. Use positive values to add padding, or negative values to crop the image and focus on specific areas. This is useful for removing unwanted whitespace or highlighting particular regions of your visualization.
    </p>
    <div class="settings-grid-margins">
      <div class="settings-item">
        <GeneralInputNumber min={-9999} label="Top" bind:value={marginTop} />
      </div>
      <div class="settings-item">
        <GeneralInputNumber
          min={-9999}
          label="Right"
          bind:value={marginRight}
        />
      </div>
      <div class="settings-item">
        <GeneralInputNumber
          min={-9999}
          label="Bottom"
          bind:value={marginBottom}
        />
      </div>
      <div class="settings-item">
        <GeneralInputNumber min={-9999} label="Left" bind:value={marginLeft} />
      </div>
    </div>
    <div class="margin-presets">
      <span class="presets-label">Margin Presets:</span>
      <GeneralButtonPreset
        label="20px"
        isActive={marginTop === 20 &&
          marginRight === 20 &&
          marginBottom === 20 &&
          marginLeft === 20}
        onclick={() => setAllMargins(20)}
      />
      <GeneralButtonPreset
        label="0px"
        isActive={marginTop === 0 &&
          marginRight === 0 &&
          marginBottom === 0 &&
          marginLeft === 0}
        onclick={() => setAllMargins(0)}
      />
    </div>
  </div>
</div>

<style>
  .margin-settings {
    margin-top: 1rem;
  }

  .hint {
    font-weight: normal;
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .margin-explanation {
    font-size: 0.85rem;
    color: var(--c-darkgrey);
    line-height: 1.4;
    margin: 0.5rem 0 1rem 0;
    padding: 0.75rem;
    background-color: #e6f3ff;
    border-radius: 4px;
    border-left: 3px solid var(--c-primary, #007acc);
  }

  .settings-grid-main {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .settings-grid-margins {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .dpi-container {
    position: relative;
  }

  .dpi-container.disabled {
    opacity: 0.7;
  }

  .dpi-presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }

  .presets-label {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
  }

  .margin-presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    margin-top: 7px;
  }

  .settings-item {
    max-width: 180px;
    width: 100%;
    flex: 1;
  }

  /* Mobile layout adjustments */
  @media (max-width: 600px) {
    .settings-grid-main,
    .settings-grid-margins {
      flex-direction: column;
    }

    .settings-item {
      max-width: 100%;
    }

    .margin-presets {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
