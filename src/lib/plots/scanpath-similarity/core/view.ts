import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { getMetric, resolveInstance } from '$lib/metrics'
import SimilarityMatrixFigure from '../components/SimilarityMatrixFigure.svelte'
import ScangraphFigure from '../components/ScangraphFigure.svelte'
import { getScanpathSimilarityData, buildScangraphData } from './transformer'
import { SCANPATH_SIMILARITY_DEFAULTS } from '../const'
import type { ScanpathSimilaritySettings } from '../types'

export interface ScanpathSimilarityView extends PlotView {
  /** Whether the on-screen container should show the figure (vs a placeholder). */
  hasData: boolean
}

/**
 * Single source of truth for "what a scanpath-similarity plot draws" — picks the
 * matrix or scangraph figure by `settings.view`. `onNodeClick` is screen-only
 * (the export passes none). The scangraph `threshold` is included here so screen
 * and export style links identically (export previously fell back to the default).
 */
export function getScanpathSimilarityView(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings,
  opts: { onNodeClick?: (nodeIndex: number) => void } = {}
): ScanpathSimilarityView {
  const similarityData = getScanpathSimilarityData(
    engine,
    settings.stimulusId,
    settings.groupId,
    settings.metricInstanceIds[0] ?? null,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0
  )
  const noMetric = similarityData.noMetric ?? false
  const hasData = similarityData.size > 0 || noMetric

  if (settings.view === 'scangraph') {
    const threshold = settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
    const scangraphData =
      similarityData.size === 0 ? null : buildScangraphData(similarityData, threshold)
    return {
      component: ScangraphFigure,
      props: {
        data: scangraphData ?? { nodes: [], links: [] },
        noMetric,
        threshold,
        highlights: settings.participantHighlights ?? [],
        onNodeClick: opts.onNodeClick,
      },
      hasData,
    }
  }

  const resolvedInstance = resolveInstance(
    engine.metadata?.metricInstances ?? [],
    settings.metricInstanceIds[0] ?? null
  )
  const resolvedMetric = resolvedInstance ? getMetric(resolvedInstance.baseId) : undefined
  return {
    component: SimilarityMatrixFigure,
    props: {
      matrix: similarityData.matrix,
      labels: similarityData.labels,
      noMetric,
      colorScale: settings.colorScale ?? [],
      colorValueRange: settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0],
      legendTitle: resolvedInstance?.label ?? resolvedMetric?.meta.label ?? 'Similarity',
    },
    hasData,
  }
}

export function deriveScanpathSimilarityView(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): PlotView {
  const v = getScanpathSimilarityView(engine, settings)
  return { component: v.component, props: v.props }
}
