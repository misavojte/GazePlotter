import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import MetricCorrelationHeatmap from '../components/MetricCorrelationHeatmap.svelte'
import MetricCorrelationSplom from '../components/MetricCorrelationSplom.svelte'
import { getMetricCorrelationData } from './transformer'
import type { MetricCorrelationSettings } from '../types'

/**
 * Single source of truth for "what a metric-correlation plot draws" — picks the
 * SPLOM or heatmap figure by `settings.view`. Both screen and export render it.
 */
export function deriveMetricCorrelationView(
  engine: DataEngine,
  settings: MetricCorrelationSettings
): PlotView {
  const isSplom = settings.view === 'splom'
  const result = getMetricCorrelationData(engine, settings, { includePoints: isSplom })
  return isSplom
    ? { component: MetricCorrelationSplom, props: { result } }
    : { component: MetricCorrelationHeatmap, props: { result } }
}
