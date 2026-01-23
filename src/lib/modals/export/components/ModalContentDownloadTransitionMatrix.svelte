<script lang="ts">
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import TransitionMatrixPlotFigure from '$lib/plots/transition-matrix/components/TransitionMatrixPlotFigure.svelte'
  import {
    getTransitionMatrixData,
    AggregationMethod,
  } from '$lib/plots/transition-matrix'
  import { PlotExportWrapper } from '$lib/modals'

  interface Props {
    settings: TransitionMatrixGridType
  }

  let { settings }: Props = $props()

  // Calculate matrix data for preview
  const { matrix, aoiLabels } = $derived(
    getTransitionMatrixData(
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
</script>

<PlotExportWrapper
  defaultFileName="GazePlotter-TransitionMatrix"
  aspectRatio={1}
>
  {#snippet children(exportProps)}
    <TransitionMatrixPlotFigure
      TransitionMatrix={matrix}
      {aoiLabels}
      width={exportProps.width}
      height={exportProps.height}
      cellSize={30}
      colorScale={settings.colorScale}
      xLabel="To AOI"
      yLabel="From AOI"
      legendTitle={getLegendTitle(settings.aggregationMethod)}
      colorValueRange={currentStimulusColorRange}
      belowMinColor={settings.belowMinColor}
      aboveMaxColor={settings.aboveMaxColor}
      showBelowMinLabels={settings.showBelowMinLabels}
      showAboveMaxLabels={settings.showAboveMaxLabels}
      dpiOverride={exportProps.dpiOverride}
      marginTop={exportProps.marginTop}
      marginRight={exportProps.marginRight}
      marginBottom={exportProps.marginBottom}
      marginLeft={exportProps.marginLeft}
    />
  {/snippet}
</PlotExportWrapper>
