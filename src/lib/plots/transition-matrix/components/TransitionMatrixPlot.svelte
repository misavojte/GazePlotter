<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import TransitionMatrixPlotFigure from './TransitionMatrixPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getTransitionView } from '$lib/plots/transition-matrix/core/view'
  import { transitionMatrixColorSync } from '$lib/plots/transition-matrix/core/sync.svelte'
  import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'

  import type { TransitionMatrixPlotItem } from '$lib/plots/transition-matrix/types'

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from; the screen adds color sync
  // (a synced colorValueRange) on top — export never syncs.
  const view = $derived(getTransitionView(engine, item.settings))

  usePlotSync(
    transitionMatrixColorSync,
    () => item.id,
    () => {
      if (!view.isDefaultColorRange) return null
      return {
        groupKey: view.syncGroupKey,
        colorScaleKey: view.colorScaleKey,
        w: item.w,
        h: item.h,
        dataMax: view.ownDataMax,
      }
    }
  )

  const colorValueRange = $derived.by<[number, number]>(() => {
    if (!view.isDefaultColorRange) return view.currentStimulusColorRange
    const syncedMax = transitionMatrixColorSync.getSyncedMax(
      view.syncGroupKey,
      view.colorScaleKey,
      item.w,
      item.h
    )
    if (syncedMax <= view.ownDataMax) return view.currentStimulusColorRange
    return [0, syncedMax]
  })
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      <TransitionMatrixPlotFigure {...view.props} {width} {height} {colorValueRange} />
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
