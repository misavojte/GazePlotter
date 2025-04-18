<script lang="ts">
  import GeneralInputNumber from '../../General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import GeneralInputText from '../../General/GeneralInput/GeneralInputText.svelte'
  import GeneralButtonPreset from '../../General/GeneralButton/GeneralButtonPreset.svelte'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import BarPlotFigure from '$lib/components/Plot/BarPlot/BarPlotFigure.svelte'
  import GeneralSvgPreview from '../../General/GeneralSvgPreview/GeneralSvgPreview.svelte'
  import { getBarPlotData } from '$lib/utils/barPlotUtils'

  interface Props {
    settings: BarPlotGridType
  }

  let { settings }: Props = $props()

  type fileType = '.svg' | '.png' | '.jpg' | '.webp'

  let typeOfExport = $state<fileType>('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-BarPlot')
  let dpi = $state(96) /* standard web DPI */

  // Replace single margin with directional margins
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for preview
  let previewContainer = $state<HTMLDivElement | null>(null)

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
    { label: 'SVG (Vector)', value: '.svg' },
    { label: 'PNG (Transparent)', value: '.png' },
    { label: 'JPG (White Background)', value: '.jpg' },
    { label: 'WebP (Modern Web Format)', value: '.webp' },
  ]

  // Calculate the effective dimensions
  const effectiveWidth = $derived(width)
  const effectiveHeight = $derived(width * 0.6) // Using a 5:3 aspect ratio

  // Apply margin presets
  function setMarginPreset(preset: number) {
    marginTop = preset
    marginRight = preset
    marginBottom = preset
    marginLeft = preset
  }

  // Apply DPI presets
  function setDpiPreset(preset: number) {
    dpi = preset
  }

  // Get bar plot data and prepare props for the figure
  const { data, timeline } = getBarPlotData(settings)

  // Props to pass to the BarPlotFigure component
  const barPlotProps = $derived({
    width: effectiveWidth - (marginLeft + marginRight),
    height: effectiveHeight - (marginTop + marginBottom),
    data,
    timeline,
    barPlottingType: settings.barPlottingType,
    barWidth: 200,
    barSpacing: 20,
    onDataHover: () => {},
  })
</script>

<div class="single-view-container">
  <!-- Settings Section -->
  <div class="settings-section">
    <h3>Export Settings</h3>
    <div class="settings-grid-main">
      <div class="settings-item">
        <GeneralInputNumber label="Width in px" bind:value={width} />
      </div>
      <div class="settings-item">
        <GeneralSelectBase
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
            onclick={() => setDpiPreset(preset.value)}
          />
        {/each}
      </div>
    {/if}

    <!-- Margin Settings -->
    <div class="margin-settings">
      <h4>Margin Settings <span class="hint">(in pixels)</span></h4>
      <div class="settings-grid-margins">
        <div class="settings-item">
          <GeneralInputNumber label="Top" bind:value={marginTop} />
        </div>
        <div class="settings-item">
          <GeneralInputNumber label="Right" bind:value={marginRight} />
        </div>
        <div class="settings-item">
          <GeneralInputNumber label="Bottom" bind:value={marginBottom} />
        </div>
        <div class="settings-item">
          <GeneralInputNumber label="Left" bind:value={marginLeft} />
        </div>
      </div>

      <!-- Margin Presets -->
      <div class="all-margins">
        <span class="presets-label">Margin Presets:</span>
        <GeneralButtonPreset
          label="None"
          isActive={marginTop === 0 &&
            marginRight === 0 &&
            marginBottom === 0 &&
            marginLeft === 0}
          onclick={() => setMarginPreset(0)}
        />
        <GeneralButtonPreset
          label="Small"
          isActive={marginTop === 10 &&
            marginRight === 10 &&
            marginBottom === 10 &&
            marginLeft === 10}
          onclick={() => setMarginPreset(10)}
        />
        <GeneralButtonPreset
          label="Medium"
          isActive={marginTop === 20 &&
            marginRight === 20 &&
            marginBottom === 20 &&
            marginLeft === 20}
          onclick={() => setMarginPreset(20)}
        />
        <GeneralButtonPreset
          label="Large"
          isActive={marginTop === 40 &&
            marginRight === 40 &&
            marginBottom === 40 &&
            marginLeft === 40}
          onclick={() => setMarginPreset(40)}
        />
      </div>
    </div>
  </div>

  <!-- Preview Section -->
  <div class="preview-section">
    <div class="preview-heading">
      <h3>Your exported plot</h3>
    </div>
    <div bind:this={previewContainer}>
      <GeneralSvgPreview
        {fileName}
        fileType={typeOfExport}
        {width}
        height={effectiveHeight}
        {marginTop}
        {marginRight}
        {marginBottom}
        {marginLeft}
        {dpi}
        showDownloadButton={true}
      >
        <BarPlotFigure {...barPlotProps} />
      </GeneralSvgPreview>
    </div>
  </div>
</div>

<style>
  .single-view-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-height: 80vh;
    max-width: 830px;
  }

  .settings-section h3,
  .preview-heading h3,
  .margin-settings h4 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .margin-settings {
    margin-top: 1rem;
  }

  .margin-settings h4 {
    font-size: 0.9rem;
  }

  .hint {
    font-weight: normal;
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .settings-grid-main {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    align-items: start;
  }

  .settings-grid-margins {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    align-items: start;
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

  .all-margins {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-start;
    margin-top: 0.5rem;
  }

  .settings-item {
    min-width: 0;
  }

  .preview-section {
    flex-grow: 1;
    height: auto;
  }
</style>
