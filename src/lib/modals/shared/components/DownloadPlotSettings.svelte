<script lang="ts">
  import {
    InputNumber,
    Select,
    InputText,
    ButtonPreset,
    Card,
  } from '$lib/shared/components'
  import { Section } from '$lib/modals'

  // Define the props interface
  interface Props {
    typeOfExport: '.svg' | '.png' | '.jpg' | '.webp'
    width: number
    height: number
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
    height = $bindable(),
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
  <Section title="Export Settings">
    <div class="settings-grid-main">
      <div class="settings-item">
        <InputNumber
          label="Width [px]"
          bind:value={width}
          min={1}
          appearance="selectMatched"
        />
      </div>
      <div class="settings-item">
        <InputNumber
          label="Height [px]"
          bind:value={height}
          min={1}
          appearance="selectMatched"
        />
      </div>
      <div class="settings-item">
        <Select label="Output file type" {options} bind:value={typeOfExport} />
      </div>
      <div class="settings-item">
        <InputText
          label="Output file name"
          bind:value={fileName}
          appearance="selectMatched"
        />
      </div>

      <!-- DPI Settings -->
      <div class="settings-item">
        <div class="dpi-container" class:disabled={!isDpiEnabled}>
          <InputNumber
            label="Resolution [DPI]"
            bind:value={dpi}
            min={72}
            disabled={!isDpiEnabled}
            appearance="selectMatched"
          />
        </div>
      </div>
    </div>
  </Section>

  <!-- DPI Presets -->
  {#if isDpiEnabled}
    <div class="dpi-presets">
      <span class="presets-label">DPI Presets:</span>
      {#each dpiPresets as preset}
        <ButtonPreset
          label={preset.label}
          isActive={dpi === preset.value}
          onclick={() => setDpi(preset.value)}
        />
      {/each}
    </div>
  {/if}

  <!-- Margin Settings -->
  <div class="margin-settings">
    <Section title="Margins">
      <Card padding="sm">
        Use positive margins to add padding, or negative values to crop the image
        and focus on specific areas.
      </Card>
      <div class="settings-grid-margins">
        <div class="settings-item">
          <InputNumber
            min={-9999}
            label="Top"
            bind:value={marginTop}
            appearance="selectMatched"
          />
        </div>
        <div class="settings-item">
          <InputNumber
            min={-9999}
            label="Right"
            bind:value={marginRight}
            appearance="selectMatched"
          />
        </div>
        <div class="settings-item">
          <InputNumber
            min={-9999}
            label="Bottom"
            bind:value={marginBottom}
            appearance="selectMatched"
          />
        </div>
        <div class="settings-item">
          <InputNumber
            min={-9999}
            label="Left"
            bind:value={marginLeft}
            appearance="selectMatched"
          />
        </div>
      </div>
      <div class="margin-presets">
        <span class="presets-label">Margin Presets:</span>
        <ButtonPreset
          label="20px"
          isActive={marginTop === 20 &&
            marginRight === 20 &&
            marginBottom === 20 &&
            marginLeft === 20}
          onclick={() => setAllMargins(20)}
        />
        <ButtonPreset
          label="0px"
          isActive={marginTop === 0 &&
            marginRight === 0 &&
            marginBottom === 0 &&
            marginLeft === 0}
          onclick={() => setAllMargins(0)}
        />
      </div>
    </Section>
  </div>
</div>

<style>
  .margin-settings {
    margin-top: 1rem;
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
    margin-top: 1rem;
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
