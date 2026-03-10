<script lang="ts">
  import type { TransitionMatrixPlotItem } from '$lib/plots/transition-matrix/types'
  import TransitionMatrixPlotFigure from '$lib/plots/transition-matrix/components/TransitionMatrixPlotFigure.svelte'
  import {
    getTransitionMatrixData,
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix'
  import { PlotExportWrapper } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  // Calculate matrix data for preview
  const { matrix, aoiLabels } = $derived(
    getTransitionMatrixData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as MatrixAggregationMethod
    )
  )

  // Get current stimulus-specific color range or use default values
  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  // Update the legend title based on the aggregation method
  function getLegendTitle(method: string): string {
    return TRANSITION_MATRIX_LEGEND_TITLES[method] ?? 'Transition Value'
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
