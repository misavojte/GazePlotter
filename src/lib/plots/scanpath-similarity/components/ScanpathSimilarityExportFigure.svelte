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
      settings.metricInstanceIds[0] ?? null,
      settings.timelineStart ?? 0,
      settings.timelineEnd ?? 0,
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

<!-- Always render the figure; it paints the canvas-based "Select a metric"
     placeholder internally when `similarityData.noMetric` is set, so exports
     include the message instead of a blank PNG/SVG. -->
{#if settings.view === 'scangraph'}
  <ScangraphFigure
    data={scangraphData ?? { nodes: [], links: [] }}
    noMetric={similarityData.noMetric ?? false}
    width={exportProps.width}
    height={exportProps.height}
    dpiOverride={exportProps.dpiOverride}
    margins={exportProps.margins}
  />
{:else}
  <SimilarityMatrixFigure
    matrix={similarityData.matrix}
    labels={similarityData.labels}
    noMetric={similarityData.noMetric ?? false}
    width={exportProps.width}
    height={exportProps.height}
    colorScale={colorScale}
    colorValueRange={colorValueRange}
    dpiOverride={exportProps.dpiOverride}
    margins={exportProps.margins}
  />
{/if}
