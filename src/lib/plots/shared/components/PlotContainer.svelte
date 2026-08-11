<script lang="ts">
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { resolvePlotDefinition } from '$lib/plots/registry'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'
  import BasePlot from './BasePlot.svelte'
  import type { PlotItemContract, PlotView } from '$lib/plots/definePlot'
  import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
  import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'

  interface Props {
    item: PlotItemContract<string, object>
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()

  // `item.type` is stable for the item's lifetime (the grid keys by id), so
  // resolving the definition once at init is deliberate. The registry value is
  // a union over all plots' settings types; this host is generic, so it works
  // through a loose view of the same contract (settings match at runtime).
  const definition = untrack(() =>
    resolvePlotDefinition(item.type)
  ) as unknown as {
    view: {
      deriveView: (
        engine: DataEngine,
        settings: object,
        ctx?: { itemWidth: number; itemHeight: number }
      ) => PlotView | null
      viewDependsOnWidth?: boolean
      viewOnlySettings?: readonly string[]
    }
    screen?: (ctx: {
      item: PlotItemContract<string, object>
      engine: DataEngine
      workspace: WorkspaceCommandBus
      view: () => PlotView | null
    }) => {
      settings?: () => object
      props?: (view: PlotView) => Record<string, unknown>
    }
  }

  // Bound after the data handle exists; recipes only call `view()` from
  // effects, deriveds and event handlers, all of which run post-init.
  let getView: () => PlotView | null = () => null

  const screen = definition.screen?.({
    get item() {
      return item
    },
    engine,
    workspace,
    view: () => getView(),
  })

  const handle = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: screen?.settings ?? (() => item.settings as object),
    viewOnly: definition.view.viewOnlySettings,
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

  // Screen-only props overlay the view's props; `screen.props` runs inside
  // this $derived, so its reactive reads (sync registries, item settings for
  // handler display state) are tracked.
  const figureProps = $derived.by(() => {
    if (!view) return null
    return screen?.props ? { ...view.props, ...screen.props(view) } : view.props
  })
</script>

<BasePlot {item} {hasData}>
  {#snippet figure({ width, height })}
    {#if view && figureProps}
      {@const Figure = view.component}
      <div class="figure-container">
        <Figure {...figureProps} {width} {height} />
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
