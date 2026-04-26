<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { ScanpathSimilarityItem } from '$lib/plots/scanpath-similarity/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import SimilarityMatrixFigure from './SimilarityMatrixFigure.svelte'
  import ScangraphFigure from './ScangraphFigure.svelte'
  import {
    buildScangraphData,
    getScanpathSimilarityData,
    SCANPATH_SIMILARITY_DEFAULTS,
  } from '$lib/plots/scanpath-similarity'

  interface Props {
    item: ScanpathSimilarityItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const similarityData = $derived(
    getScanpathSimilarityData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.metricInstanceId,
    )
  )

  const scangraphData = $derived.by(() => {
    if (settings.view !== 'scangraph') return null
    if (similarityData.size === 0) return null
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
