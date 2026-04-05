<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { TransitionMatrixPlotItem } from '$lib/plots/transition-matrix/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import TransitionMatrixPlotFigure from './TransitionMatrixPlotFigure.svelte'
  import {
    getTransitionMatrixData,
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix'

  interface Props {
    item: TransitionMatrixPlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const { matrix, aoiLabels } = $derived(
    getTransitionMatrixData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as MatrixAggregationMethod
    )
  )

  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  function getLegendTitle(method: string): string {
    return TRANSITION_MATRIX_LEGEND_TITLES[method] ?? 'Transition Value'
  }
</script>

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
