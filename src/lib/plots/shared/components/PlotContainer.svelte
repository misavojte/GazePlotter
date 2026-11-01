<script lang="ts">
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { resolvePlotDefinition } from '$lib/plots/registry'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'
  import { usePlotHost, type PlotHostDefinition } from '$lib/plots/shared/plotHost.svelte'
  import BasePlot from './BasePlot.svelte'
  import PlotViewFigure from './PlotViewFigure.svelte'
  import type { PlotItemContract, PlotView } from '$lib/plots/definePlot'
  import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'

  interface Props {
    item: PlotItemContract<string, Record<string, unknown>>
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()

  // `item.type` is stable for the item's lifetime (the grid keys by id), so
  // resolving the definition once at init is deliberate. The registry value is
  // a union over all plots' settings types; this host is generic, so it works
  // through a loose view of the same contract (settings match at runtime).
  const definition = untrack(() => resolvePlotDefinition(item.type)) as unknown as PlotHostDefinition & {
    view: {
      deriveView: (
        engine: DataEngine,
        settings: object,
        ctx?: { itemWidth: number; itemHeight: number }
      ) => PlotView | null
      viewDependsOnWidth?: boolean
    }
  }

  // Bound after the data handle exists; the host reads it only from deriveds.
  let getView: () => PlotView | null = () => null

  const plotHost = usePlotHost({
    definition,
    item: () => item,
    engine,
    workspace,
    view: () => getView(),
  })

  const handle = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: plotHost.settings,
    viewOnly: definition.view.viewOnly?.settings,
    watch: definition.view.viewDependsOnWidth ? () => item.w : undefined,
    derive: s =>
      definition.view.deriveView(engine, s, {
        itemWidth: item.w,
        itemHeight: item.h,
      }),
  })
  getView = () => handle.current

  const view = $derived(handle.current)
  const hasData = $derived(view !== null && view.hasData !== false)
  // The view's input with view-only settings and synced values merged over it.
  const input = $derived(view ? plotHost.input(view) : null)
</script>

<BasePlot {item} {hasData}>
  {#snippet figure({ width, height })}
    {#if view && input}
      <div class="figure-container">
        <PlotViewFigure
          {view}
          {input}
          host={plotHost.host}
          playback={definition.playback ?? false}
          {width}
          {height}
        />
      </div>
    {/if}
  {/snippet}
</BasePlot>

<style>
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
