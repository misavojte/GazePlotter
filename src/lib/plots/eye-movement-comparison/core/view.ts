import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import {
  BeeswarmFigure,
  buildBeeswarmFigureProps,
} from '$lib/plots/shared/distribution/beeswarm'
import { resolvePickedInstance } from '$lib/plots/shared'
import { getEyeMovementComparisonData } from './transformer'
import type { EyeMovementComparisonSettings } from '../types'

/**
 * The `definePlot` view entry — the single derivation for screen and export.
 * Renders through the shared `BeeswarmFigure` (the figure's data contract is
 * category-agnostic) off the SAME props builder as the AOI Comparison, so the
 * axis label, the proportion/overlay rule and the figure geometry cannot drift
 * between the two plots; only the three disclosure strings differ.
 */
export function deriveEyeMovementComparisonView(
  engine: DataEngine,
  settings: EyeMovementComparisonSettings
): PlotView {
  const result = getEyeMovementComparisonData(engine, settings)
  const props = buildBeeswarmFigureProps(
    result,
    resolvePickedInstance(engine, settings.metricInstanceIds),
    settings,
    {
      itemTooltipKey: 'Type',
      cannotFitHints: ['Select fewer types in Plot Settings > Eye-movement Types'],
      ariaLabel: 'Eye-movement type comparison',
    }
  )
  return {
    component: BeeswarmFigure,
    props: props as unknown as Record<string, unknown>,
  }
}
