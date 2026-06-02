<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { AoiStreamPlotItem } from '$lib/plots/aoi-stream/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import AoiStreamPlotFigure from './AoiStreamPlotFigure.svelte'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/core'
  import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import { scanForSynchronizedTimelineMax } from '../sync'

  interface Props {
    item: AoiStreamPlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)
  const { grid } = getGazePlotterSession()

  const timelineMinValue = $derived.by(() => {
    if ((settings.timelineStart ?? 0) > 0) return settings.timelineStart!
    return settings.absoluteStimuliLimits[settings.stimulusId]?.[0] ?? 0
  })

  const timelineMaxValue = $derived.by(() => {
    const maxValue =
      settings.absoluteStimuliLimits[settings.stimulusId]?.[1] ?? 0
    if ((settings.timelineEnd ?? 0) > 0) return settings.timelineEnd!
    if (maxValue !== 0) return maxValue

    const syncedMax = scanForSynchronizedTimelineMax(
      engine,
      grid.items,
      item.w,
      settings.stimulusId,
      settings.absoluteStimuliLimits
    )
    if (syncedMax !== null) return syncedMax

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

  const streamData = $derived(
    getAoiStreamPlotData(engine, {
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      metricInstanceIds: settings.metricInstanceIds,
      timelineMin: timelineMinValue,
      timelineMax: timelineMaxValue,
      hideNoAoi: settings.hideNoAoi,
    })
  )
</script>

<!-- Always render the figure; it paints the canvas-based "Select a metric"
     placeholder internally when `streamData.noMetric` is set, so exports
     include the message instead of a blank PNG/SVG. -->
<AoiStreamPlotFigure
  width={exportProps.width}
  height={exportProps.height}
  data={streamData}
  alignment={settings.alignment ?? 'stream'}
  highlights={settings.highlights ?? []}
  dpiOverride={exportProps.dpiOverride}
  marginTop={exportProps.marginTop}
  marginRight={exportProps.marginRight}
  marginBottom={exportProps.marginBottom}
  marginLeft={exportProps.marginLeft}
/>
