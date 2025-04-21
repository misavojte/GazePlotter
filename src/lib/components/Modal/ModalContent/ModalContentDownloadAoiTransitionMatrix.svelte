<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'
  import AoiTransitionMatrixPlotFigure from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixPlotFigure.svelte'
  import GeneralSvgPreview from '$lib/components/General/GeneralSvgPreview/GeneralSvgPreview.svelte'
  import {
    calculateTransitionMatrix,
    AggregationMethod,
  } from '$lib/utils/aoiTransitionMatrixTransformations'

  interface Props {
    settings: AoiTransitionMatrixGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.svg' | '.png' | '.jpg' | '.webp'>('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-AoiTransitionMatrix')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for preview
  let previewContainer = $state<HTMLDivElement | null>(null)

  // Calculate matrix data for preview
  const { matrix, aoiLabels } = $derived(
    calculateTransitionMatrix(
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as AggregationMethod
    )
  )

  // Get current stimulus-specific color range or use default values
  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  // Calculate the effective width (what will be available for the chart after margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))

  // Use the height directly from the data with additional space for legend and axes
  // Add fixed padding (150px) plus margins to maintain proper spacing
  const previewHeight = $derived(
    width + 150 + marginTop + marginBottom // Square matrix + legend + margins
  )

  // Props to pass to the AoiTransitionMatrixPlotFigure component
  const matrixPlotProps = $derived({
    AoiTransitionMatrix: matrix,
    aoiLabels,
    width: effectiveWidth - (marginLeft + marginRight), // Subtract margins from width
    height: effectiveWidth - (marginBottom + marginTop), // Keep it square
    cellSize: 30,
    colorScale: settings.colorScale,
    xLabel: 'To AOI',
    yLabel: 'From AOI',
    legendTitle: 'Transition Count',
    colorValueRange: currentStimulusColorRange,
    belowMinColor: settings.belowMinColor,
    aboveMaxColor: settings.aboveMaxColor,
    showBelowMinLabels: settings.showBelowMinLabels,
    showAboveMaxLabels: settings.showAboveMaxLabels,
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
        <AoiTransitionMatrixPlotFigure {...matrixPlotProps} />
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
