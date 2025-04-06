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

  // Replace single margin with directional margins
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for preview
  let highlightedIdentifier = $state<string | null>(null)
  let tooltipAreaElement = $state<HTMLElement | SVGElement | null>(null)
  let previewContainer = $state<HTMLDivElement | null>(null)

  const options = [
    { value: '.svg', label: 'SVG (recommended)' },
    { value: '.png', label: 'PNG' },
    { value: '.jpg', label: 'JPG' },
    { value: '.webp', label: 'WEBP' },
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
    </div>

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
  }
</style>
