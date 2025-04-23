<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'
  import AoiTransitionMatrixPlotFigure from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixPlotFigure.svelte'
  import {
    calculateTransitionMatrix,
    AggregationMethod,
  } from '$lib/utils/aoiTransitionMatrixTransformations'
  import GeneralCanvasPreview from '$lib/components/General/GeneralCanvasPreview/GeneralCanvasPreview.svelte'

  interface Props {
    settings: AoiTransitionMatrixGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-AoiTransitionMatrix')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

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

  // Calculate the effective height for the matrix plot
  // AOI Transition matrix is ideally square with additional space for legend
  const effectiveHeight = $derived(effectiveWidth)

  // Total height with legend space
  const totalHeight = $derived(effectiveWidth) // Square matrix + more legend space (increased from 150)

  // Update the legend title based on the aggregation method
  function getLegendTitle(method: string): string {
    switch (method) {
      case AggregationMethod.SUM:
        return 'Transition Count'
      case AggregationMethod.PROBABILITY:
        return 'Transition Probability (%)'
      case AggregationMethod.DWELL_TIME:
        return 'Dwell Time (ms)'
      case AggregationMethod.SEGMENT_DWELL_TIME:
        return 'Segment Dwell Time (ms)'
      default:
        return 'Transition Value'
    }
  }

  // Props to pass to the AoiTransitionMatrixPlotFigure component
  const matrixPlotProps = $derived({
    AoiTransitionMatrix: matrix,
    aoiLabels,
    width: effectiveWidth,
    height: effectiveHeight,
    cellSize: 30,
    colorScale: settings.colorScale,
    xLabel: 'To AOI',
    yLabel: 'From AOI',
    legendTitle: getLegendTitle(settings.aggregationMethod),
    colorValueRange: currentStimulusColorRange,
    belowMinColor: settings.belowMinColor,
    aboveMaxColor: settings.aboveMaxColor,
    showBelowMinLabels: settings.showBelowMinLabels,
    showAboveMaxLabels: settings.showAboveMaxLabels,
    dpiOverride: dpi, // Pass the dpi directly to the component
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
    <div>
      <GeneralCanvasPreview
        {fileName}
        fileType={typeOfExport}
        {width}
        height={totalHeight + marginTop + marginBottom}
        {marginTop}
        {marginRight}
        {marginBottom}
        {marginLeft}
        {dpi}
        showDownloadButton={true}
      >
        <AoiTransitionMatrixPlotFigure {...matrixPlotProps} />
      </GeneralCanvasPreview>
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
  }
</style>
