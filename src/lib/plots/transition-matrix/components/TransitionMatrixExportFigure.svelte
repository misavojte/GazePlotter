<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { TransitionMatrixPlotItem } from '$lib/plots/transition-matrix/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import TransitionMatrixPlotFigure from './TransitionMatrixPlotFigure.svelte'
  import {
    getTransitionMatrixData,
    getLegendTitle,
  } from '$lib/plots/transition-matrix'
  import { getMetric, resolveInstanceWithFallback } from '$lib/metrics'

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
      settings.metricInstanceId,
    )
  )

  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  const resolved = $derived.by(() => {
    const inst = resolveInstanceWithFallback(
      settings.metricInstanceId,
      'transitionCount',
      engine.metadata?.metricInstances ?? [],
    )
    return {
      label: inst?.label ?? '',
      unit: inst ? (getMetric(inst.baseId)?.meta.unit ?? '') : '',
    }
  })
</script>

<TransitionMatrixPlotFigure
  TransitionMatrix={matrix}
  {aoiLabels}
  width={exportProps.width}
  height={exportProps.height}
  colorScale={settings.colorScale}
  xLabel="To AOI"
  yLabel="From AOI"
  legendTitle={getLegendTitle(resolved.label, resolved.unit)}
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
