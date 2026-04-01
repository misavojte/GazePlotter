<script lang="ts">
  import type { ScanpathSimilarityItem } from '$lib/plots/scanpath-similarity/types'
  import SimilarityMatrixFigure from '$lib/plots/scanpath-similarity/components/SimilarityMatrixFigure.svelte'
  import ScangraphFigure from '$lib/plots/scanpath-similarity/components/ScangraphFigure.svelte'
  import {
    buildScangraphData,
    getScanpathSimilarityData,
    SCANPATH_SIMILARITY_DEFAULTS,
  } from '$lib/plots/scanpath-similarity'
  import { PlotExportWrapper } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getWorkspaceCanvasExportDimensions } from '$lib/modals/export/shared/helpers'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { engine, grid } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const exportDimensions = $derived(
    getWorkspaceCanvasExportDimensions(item, grid.config, 0)
  )

  const similarityData = $derived(
    getScanpathSimilarityData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.similarityMethod,
      settings.collapsed
    )
  )

  const scangraphData = $derived.by(() => {
    if (settings.view !== 'scangraph') return null
    return buildScangraphData(
      similarityData,
      settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
    )
  })

  const colorScale = $derived(
    settings.colorScale?.length
      ? settings.colorScale
      : [...SCANPATH_SIMILARITY_DEFAULTS.colorScale]
  )

  const colorValueRange = $derived(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )
</script>

<PlotExportWrapper
  defaultFileName="GazePlotter-ScanpathSimilarity"
  defaultWidth={exportDimensions.width}
  defaultHeight={exportDimensions.height}
  defaultMargin={0}
>
  {#snippet children(exportProps)}
    {#if settings.view === 'scangraph' && scangraphData}
      <ScangraphFigure
        data={scangraphData}
        width={exportProps.width}
        height={exportProps.height}
        dpiOverride={exportProps.dpiOverride}
        marginTop={exportProps.marginTop}
        marginRight={exportProps.marginRight}
        marginBottom={exportProps.marginBottom}
        marginLeft={exportProps.marginLeft}
      />
    {:else}
      <SimilarityMatrixFigure
        matrix={similarityData.matrix}
        labels={similarityData.labels}
        width={exportProps.width}
        height={exportProps.height}
        colorScale={colorScale}
        colorValueRange={colorValueRange}
        dpiOverride={exportProps.dpiOverride}
        marginTop={exportProps.marginTop}
        marginRight={exportProps.marginRight}
        marginBottom={exportProps.marginBottom}
        marginLeft={exportProps.marginLeft}
      />
    {/if}
  {/snippet}
</PlotExportWrapper>
