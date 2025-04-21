<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import ScarfPlotFigure from '$lib/components/Plot/ScarfPlot/ScarfPlotFigure/ScarfPlotFigure.svelte'
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import GeneralSvgPreview from '$lib/components/General/GeneralSvgPreview/GeneralSvgPreview.svelte'

  interface Props {
    settings: ScarfGridType
    data: ScarfFillingType
  }

  let { settings, data }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.svg' | '.png' | '.jpg' | '.webp'>('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-ScarfPlot')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for preview
  let highlightedIdentifier = $state<string | null>(null)
  let tooltipAreaElement = $state<HTMLElement | SVGElement | null>(null)
  let previewContainer = $state<HTMLDivElement | null>(null)

  // Calculate the effective width (what will be available for the chart after margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))

  // Use the height directly from the data with additional space for legend and axes
  // Add fixed padding (150px) plus margins to maintain proper spacing
  const previewHeight = $derived(
    data.chartHeight + 130 + marginTop + marginBottom
  )

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
  <!-- Settings Section using shared component -->
  <DownloadPlotSettings
    bind:typeOfExport
    bind:width
    bind:fileName
    bind:dpi
    bind:marginTop
    bind:marginRight
    bind:marginBottom
    bind:marginLeft
    allowNegativeMargins={true}
  />

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
        showDownloadButton={true}
      >
        <ScarfPlotFigure {...scarfPlotProps} />
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

  .preview-heading h3 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    font-weight: 600;
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
    .preview-section {
      overflow-x: auto;
    }
  }
</style>
