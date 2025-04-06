<script lang="ts">
  import GeneralInputNumber from '../../General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import GeneralInputText from '../../General/GeneralInput/GeneralInputText.svelte'
  import MajorButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import ScarfPlotFigure from '$lib/components/Plot/ScarfPlot/ScarfPlotFigure/ScarfPlotFigure.svelte'
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import GeneralSvgPreview from '../../General/GeneralSvgPreview/GeneralSvgPreview.svelte'

  interface Props {
    settings: ScarfGridType
    data: ScarfFillingType
  }

  let { settings, data }: Props = $props()

  type fileType = '.svg' | '.png' | '.jpg' | '.webp'

  let typeOfExport = $state<fileType>('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-ScarfPlot')
  let dpi = $state(96) /* standard web DPI */

  // Replace single margin with directional margins
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for preview
  let highlightedIdentifier = $state<string | null>(null)
  let tooltipAreaElement = $state<HTMLElement | SVGElement | null>(null)
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

  const options = [
    { value: '.svg', label: 'SVG (recommended)' },
    { value: '.png', label: 'PNG' },
    { value: '.jpg', label: 'JPG' },
  ]

  // Calculate the effective width (what will be available for the chart after margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))

  // Use the height directly from the data with additional space for legend and axes
  // Add fixed padding (150px) plus margins to maintain proper spacing
  const previewHeight = $derived(
    data.chartHeight + 150 + marginTop + marginBottom
  )

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

  // Handlers for ScarfPlotFigure
  const handleLegendClick = (identifier: string) => {
    highlightedIdentifier =
      identifier === highlightedIdentifier ? null : identifier
  }

  const handleTooltipActivation = () => {}
  const handleTooltipDeactivation = () => {}

  // Props to pass to the ScarfPlotFigure component using $derived
  const scarfPlotProps = $derived({
    data,
    settings,
    highlightedIdentifier,
    tooltipAreaElement,
    onLegendClick: handleLegendClick,
    onTooltipActivation: handleTooltipActivation,
    onTooltipDeactivation: handleTooltipDeactivation,
    chartWidth: effectiveWidth, // IMPORTANT: Use effectiveWidth for the chart
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
          <button
            class="preset-btn"
            class:active={dpi === preset.value}
            onclick={() => setDpi(preset.value)}
          >
            {preset.label}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Margin Settings -->
    <div class="margin-settings">
      <h4>
        Margins <span class="hint">(negative values will crop the image)</span>
      </h4>
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
          <GeneralInputNumber
            min={-9999}
            label="Left"
            bind:value={marginLeft}
          />
        </div>
        <div class="settings-item all-margins">
          <button class="set-all-btn" onclick={() => setAllMargins(20)}
            >Set all to 20px</button
          >
          <button class="set-all-btn" onclick={() => setAllMargins(0)}
            >Set all to 0px</button
          >
        </div>
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
        height={previewHeight}
        {marginTop}
        {marginRight}
        {marginBottom}
        {marginLeft}
        {dpi}
        children={ScarfPlotFigure}
        childProps={scarfPlotProps}
        showDownloadButton={true}
      />
    </div>
  </div>
</div>

<style>
  .single-view-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 80vh;
    max-width: 830px;
  }

  .settings-section h3,
  .preview-heading h3,
  .margin-settings h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .margin-settings {
    margin-top: 0.75rem;
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
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    align-items: start;
  }

  .settings-grid-margins {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 0.75rem;
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
    margin: 0.5rem 0;
  }

  .dpi-help {
    width: 100%;
    margin-top: 0.25rem;
  }

  .dpi-hint {
    font-size: 0.7rem;
    color: #777;
    font-style: italic;
  }

  .presets-label {
    font-size: 0.8rem;
    color: #555;
  }

  .preset-btn {
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .preset-btn:hover {
    background-color: #e0e0e0;
  }

  .preset-btn.active {
    background-color: #007bff;
    color: white;
    border-color: #0069d9;
  }

  .all-margins {
    grid-column: span 4;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-start;
    margin-top: 0.25rem;
  }

  .set-all-btn {
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .set-all-btn:hover {
    background-color: #e0e0e0;
  }

  .settings-item {
    min-width: 0;
  }

  .preview-section {
    flex-grow: 1;
    overflow: auto;
  }

  /* Responsive layout for wider screens */
  @media (min-width: 768px) {
    .single-view-container {
      max-height: none;
    }
  }

  /* Mobile layout adjustments */
  @media (max-width: 600px) {
    .settings-grid-main,
    .settings-grid-margins {
      grid-template-columns: 1fr;
    }

    .all-margins {
      grid-column: span 1;
    }

    .dpi-presets {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
