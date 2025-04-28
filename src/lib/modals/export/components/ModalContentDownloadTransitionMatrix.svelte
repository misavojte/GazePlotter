<script lang="ts">
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import TransitionMatrixPlotFigure from '$lib/plots/transition-matrix/components/TransitionMatrixPlotFigure.svelte'
  import {
    calculateTransitionMatrix,
    AggregationMethod,
  } from '$lib/plots/transition-matrix/'
  import GeneralCanvasPreview from '$lib/modals/shared/components/CanvasPreview.svelte'
  import { SectionHeader, DownloadPlotSettings } from '$lib/modals'

  interface Props {
    settings: TransitionMatrixGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-TransitionMatrix')
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
  // Transition Matrix is ideally square with additional space for legend
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

  // Props to pass to the TransitionMatrixPlotFigure component
  const matrixPlotProps = $derived({
    TransitionMatrix: matrix,
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
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
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
  />

  <!-- Preview Section -->
  <div class="preview-section">
    <SectionHeader text="Your exported plot" />
    <div>
      <GeneralCanvasPreview
        {fileName}
        fileType={typeOfExport}
        showDownloadButton={true}
      >
        <TransitionMatrixPlotFigure {...matrixPlotProps} />
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

  .preview-section {
    flex-grow: 1;
  }
</style>
