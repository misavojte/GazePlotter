<script lang="ts">
  import { untrack } from 'svelte'

  import AoiStreamPlotFigure from './AoiStreamPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { computeAoiStreamData } from '../core/view'
  import { scanForDynamicRidgelineReferenceHeight } from '../sync'
  import { getGazePlotterSession } from '$lib/session'

  import type { AoiStreamPlotItem } from '$lib/plots/aoi-stream/types'
  import type { AoiStreamPlotResult } from '../types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { toggleInArray } from '$lib/plots/shared'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace, grid } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  // Same data derivation the export modal renders from — including the
  // cross-plot timeline sync (via the grid items). Kept inside an effect
  // (gated on redrawTimestamp + metadata) to match the prior recompute timing.
  let resultState = $state<{ data: AoiStreamPlotResult | null }>({ data: null })

  $effect(() => {
    const s = settings
    const gridItems = grid.items
    const w = item.w
    const h = item.h
    const meta = engine.metadata
    void item.redrawTimestamp

    if (!meta) return

    untrack(() => {
      resultState.data = computeAoiStreamData(engine, s, {
        gridItems,
        itemWidth: w,
        itemHeight: h,
      })
    })
  })

  const streamResult = $derived(resultState.data)
  const hasRenderableData = $derived(
    !!streamResult && !streamResult.noMetric && streamResult.series.length > 0
  )

  const syncedMTopOverride = $derived.by(() => {
    if (settings.alignment !== 'ridgeline' || !streamResult || !hasRenderableData) {
      return null
    }
    return scanForDynamicRidgelineReferenceHeight(
      engine,
      grid.items,
      item.h,
      item.id,
      {
        plotId: item.id,
        widthUnits: item.w,
        heightUnits: item.h,
        settings,
        streamData: streamResult,
      }
    )
  })

  const handleLegendClick = (aoiId: number) => {
    workspace.updateItemSettings(
      item.id,
      {
        highlights: toggleInArray(settings.highlights ?? [], aoiId.toString()),
      },
      source
    )
  }
</script>

<BasePlot {item} hasData={!!streamResult}>
  {#snippet figure({ width, height })}
    {#if streamResult}
      <AoiStreamPlotFigure
        {width}
        {height}
        data={streamResult}
        highlights={settings.highlights}
        alignment={settings.alignment ?? 'stream'}
        onLegendClick={handleLegendClick}
        {syncedMTopOverride}
        ridgelineScale={settings.ridgelineScale}
        colorScale={settings.colorScale}
      />
    {/if}
  {/snippet}
</BasePlot>
