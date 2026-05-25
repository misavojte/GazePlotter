<script lang="ts">
  import { onDestroy } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'

  import { TransitionMatrixPlotFigure } from '$lib/plots/transition-matrix/components'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getTransitionMatrixData } from '$lib/plots/transition-matrix/core/transformer'
  import {
    transitionMatrixColorSync,
    colorScaleToKey,
  } from '$lib/plots/transition-matrix/core/sync.svelte'
  import { getLegendTitle } from '$lib/plots/transition-matrix/const'

  import { getMetric, resolveInstance } from '$lib/metrics'
  import type { TransitionMatrixPlotItem } from '$lib/plots/transition-matrix/types'

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const currentStimulusColorRange = $derived<[number, number]>(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  const effectiveColorScale = $derived(settings.colorScale ?? [])

  const resolvedInstance = $derived(
    resolveInstance(engine.metadata?.metricInstances ?? [], settings.metricInstanceIds[0] ?? null)
  )

  const resolvedMetric = $derived(
    resolvedInstance ? getMetric(resolvedInstance.baseId) : undefined
  )

  const transitionData = $derived(
    getTransitionMatrixData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.metricInstanceIds[0] ?? null,
      settings.timelineStart ?? 0,
      settings.timelineEnd ?? 0,
    )
  )

  const { aoiLabels, matrix } = $derived(transitionData)

  const ownDataMax = $derived.by(() => {
    let max = 0
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] > max) max = matrix[i]
    }
    return Math.ceil(max)
  })

  const isDefaultColorRange = $derived(
    currentStimulusColorRange[0] === 0 && currentStimulusColorRange[1] === 0
  )

  const effectiveColorScaleKey = $derived(colorScaleToKey(effectiveColorScale))

  /** Matrices sharing the same instance are directly comparable (same metric + params). */
  const syncGroupKey = $derived(String(resolvedInstance?.id ?? 'none'))

  $effect(() => {
    if (!isDefaultColorRange) {
      transitionMatrixColorSync.clearEntry(item.id)
      return
    }
    transitionMatrixColorSync.setEntry(item.id, {
      groupKey: syncGroupKey,
      colorScaleKey: effectiveColorScaleKey,
      w: item.w,
      h: item.h,
      dataMax: ownDataMax,
    })
  })
  onDestroy(() => transitionMatrixColorSync.clearEntry(item.id))

  const effectiveColorValueRange = $derived.by<[number, number]>(() => {
    if (!isDefaultColorRange) return currentStimulusColorRange
    const syncedMax = transitionMatrixColorSync.getSyncedMax(
      syncGroupKey,
      effectiveColorScaleKey,
      item.w,
      item.h
    )
    if (syncedMax <= ownDataMax) return currentStimulusColorRange
    return [0, syncedMax]
  })

  const legendTitle = $derived(
    getLegendTitle(
      resolvedInstance?.label ?? resolvedMetric?.meta.label ?? '',
      resolvedMetric?.meta.unit ?? '',
    )
  )
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      <TransitionMatrixPlotFigure
        TransitionMatrix={matrix}
        {aoiLabels}
        {width}
        {height}
        colorScale={effectiveColorScale}
        xLabel="To AOI"
        yLabel="From AOI"
        {legendTitle}
        colorValueRange={effectiveColorValueRange}
        belowMinColor={settings.belowMinColor}
        aboveMaxColor={settings.aboveMaxColor}
        showBelowMinLabels={settings.showBelowMinLabels}
        showAboveMaxLabels={settings.showAboveMaxLabels}
        noMetric={transitionData.noMetric ?? false}
      />
    </div>
  {/snippet}
</BasePlot>

<style>
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
