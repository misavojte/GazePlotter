import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import BarPlotFigure from '$lib/plots/bar/components/BarPlotFigure.svelte'
import { buildBarFigureProps } from '$lib/plots/bar/core/view'
import { resolvePickedInstance } from '$lib/plots/shared'
import { getEyeMovementComparisonData } from './transformer'
import type { EyeMovementComparisonSettings } from '../types'

/**
 * The `definePlot` view entry — the single derivation for screen and export.
 * Renders through the AOI Comparison's `BarPlotFigure` (the figure's data
 * contract is category-agnostic) off the SAME props builder, so the axis
 * label, the proportion/overlay rule and the figure geometry cannot drift
 * between the two plots; only the three disclosure strings differ.
 */
export function deriveEyeMovementComparisonView(
  engine: DataEngine,
  settings: EyeMovementComparisonSettings
): PlotView {
  const result = getEyeMovementComparisonData(engine, settings)
  const props = buildBarFigureProps(
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
    component: BarPlotFigure,
    props: props as unknown as Record<string, unknown>,
  }
}
