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
  import {
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix/const'

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

  const transitionData = $derived.by(() => {
    return getTransitionMatrixData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as MatrixAggregationMethod
    )
  })

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

  $effect(() => {
    if (!isDefaultColorRange) {
      transitionMatrixColorSync.clearEntry(item.id)
      return
    }
    transitionMatrixColorSync.setEntry(item.id, {
      aggregationMethod: settings.aggregationMethod,
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
      settings.aggregationMethod,
      effectiveColorScaleKey,
      item.w,
      item.h
    )
    if (syncedMax <= ownDataMax) return currentStimulusColorRange
    return [0, syncedMax]
  })
</script>

<BasePlot
  {item}
  hasData={settings?.stimulusId !== undefined && aoiLabels.length > 0}
>
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
        legendTitle={TRANSITION_MATRIX_LEGEND_TITLES[
          settings.aggregationMethod
        ] ?? 'Transition Value'}
        colorValueRange={effectiveColorValueRange}
        belowMinColor={settings.belowMinColor}
        aboveMaxColor={settings.aboveMaxColor}
        showBelowMinLabels={settings.showBelowMinLabels}
        showAboveMaxLabels={settings.showAboveMaxLabels}
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
