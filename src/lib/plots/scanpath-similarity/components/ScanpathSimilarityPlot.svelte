<script lang="ts">
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'

  import SimilarityMatrixFigure from './SimilarityMatrixFigure.svelte'
  import ScangraphFigure from './ScangraphFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'
  import { toggleInArray } from '$lib/plots/shared'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getScanpathSimilarityData,
    buildScangraphData,
  } from '../core/transformer'

  import { SIMILARITY_LEGEND_TITLES } from '../const'
  import type { ScanpathSimilarityItem } from '../types'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))

  const effectiveColorScale = $derived(settings.colorScale ?? [])
  const colorValueRange = $derived<[number, number]>(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  const similarityData = $derived.by(() => {
    return getScanpathSimilarityData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.similarityMethod ?? 'levenshtein',
      settings.collapsed ?? false
    )
  })

  const scangraphData = $derived.by(() => {
    if (settings.view !== 'scangraph') return null
    return buildScangraphData(similarityData, settings.threshold ?? 0.5)
  })

  const handleNodeClick = (nodeIndex: number) => {
    workspace.updateItemSettings(
      item.id,
      {
        participantHighlights: toggleInArray(
          settings.participantHighlights ?? [],
          nodeIndex
        ),
      },
      source
    )
  }
</script>

<BasePlot {item} hasData={similarityData.size > 0}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if (settings.view ?? 'matrix') === 'matrix'}
        <SimilarityMatrixFigure
          matrix={similarityData.matrix}
          labels={similarityData.labels}
          {width}
          {height}
          colorScale={effectiveColorScale}
          {colorValueRange}
          legendTitle={SIMILARITY_LEGEND_TITLES[
            settings.similarityMethod ?? 'levenshtein'
          ] ?? 'Similarity'}
        />
      {:else if settings.view === 'scangraph' && scangraphData}
        <ScangraphFigure
          data={scangraphData}
          {width}
          {height}
          threshold={settings.threshold ?? 0.5}
          highlights={settings.participantHighlights ?? []}
          onNodeClick={handleNodeClick}
        />
      {/if}
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
