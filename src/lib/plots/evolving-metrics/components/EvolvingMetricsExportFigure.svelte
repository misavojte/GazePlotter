<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import EvolvingMetricsPlotFigure from './EvolvingMetricsPlotFigure.svelte'
  import { getEvolvingMetricsData } from '$lib/plots/evolving-metrics/core'
  import { getParticipants, getParticipantEndTime } from '$lib/data/engine'

  interface Props {
    item: EvolvingMetricsItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const timelineMaxValue = $derived.by(() => {
    if ((settings.timelineEnd ?? 0) > 0) return settings.timelineEnd!

    const participants = getParticipants(
      engine,
      settings.groupId,
      settings.stimulusId
    )
    return participants.reduce(
      (max, participant) =>
        Math.max(
          max,
          getParticipantEndTime(engine, settings.stimulusId, participant.id)
        ),
      0
    )
  })

  const evolvingData = $derived.by(() =>
    getEvolvingMetricsData(engine, {
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      metricInstanceIds: settings.metricInstanceIds,
      timelineMin: settings.timelineStart ?? 0,
      timelineMax: timelineMaxValue,
    })
  )
</script>

<!-- Always render the figure; it paints the canvas-based "Select a metric"
     placeholder internally when `evolvingData.noMetric` is set, so exports
     include the message instead of a blank PNG/SVG. -->
<EvolvingMetricsPlotFigure
  width={exportProps.width}
  height={exportProps.height}
  data={evolvingData}
  alignment={settings.presentation ?? 'heatmap'}
  colorScale={settings.colorScale}
  dpiOverride={exportProps.dpiOverride}
  marginTop={exportProps.marginTop}
  marginRight={exportProps.marginRight}
  marginBottom={exportProps.marginBottom}
  marginLeft={exportProps.marginLeft}
/>
