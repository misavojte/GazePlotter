<script lang="ts">
  import { untrack } from 'svelte'

  import { EvolvingMetricsFigure } from '$lib/plots/evolving-metrics/components'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getEvolvingMetricsData } from '../core'
  import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'

  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'
  import type { EvolvingMetricsResult } from '../types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
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

  let resultData = $state<EvolvingMetricsResult | null>(null)

  $effect(() => {
    const s = settings
    const tMax = timelineMaxValue
    const meta = engine.metadata
    void item.redrawTimestamp

    if (!meta) return

    untrack(() => {
      resultData = getEvolvingMetricsData(engine, {
        ...s,
        timelineMin: s.timelineStart ?? 0,
        timelineMax: tMax,
      })
    })
  })
</script>

<BasePlot {item} hasData={!!resultData}>
  {#snippet figure({ width, height })}
    {#if resultData}
      <EvolvingMetricsFigure
        {width}
        {height}
        data={resultData}
        alignment={settings.presentation ?? 'heatmap'}
        colorScale={settings.colorScale}
      />
    {/if}
  {/snippet}
</BasePlot>
