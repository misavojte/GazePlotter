import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import BarPlotFigure from '$lib/plots/bar/components/BarPlotFigure.svelte'
import type { BarFigureProps } from '$lib/plots/bar/core/view'
import { getComparisonAxisLabel } from './const'
import { getEyeMovementComparisonData } from './transformer'
import type { EyeMovementComparisonSettings } from '../types'

/**
 * The `definePlot` view entry — the single derivation for screen and export.
 * Renders through the AOI Comparison's `BarPlotFigure` (the figure's data
 * contract is category-agnostic); only the three disclosure strings differ.
 */
export function deriveEyeMovementComparisonView(
  engine: DataEngine,
  settings: EyeMovementComparisonSettings
): PlotView {
  const result = getEyeMovementComparisonData(engine, settings)
  // Typed against the figure (like deriveBarView), cast only at the boundary.
  const props: BarFigureProps = {
    data: result.data,
    timeline: result.timeline,
    axisLabel: getComparisonAxisLabel(
      settings.metric,
      settings.timelineStart,
      settings.timelineEnd,
      settings.statisticalOverlay
    ),
    barPlottingType: settings.barPlottingType,
    barWidth: 200,
    barSpacing: 20,
    onDataHover: () => {},
    statisticalOverlay: settings.statisticalOverlay,
    itemTooltipKey: 'Type',
    cannotFitHints: [
      'Select fewer types in Plot Settings > Eye-movement Types',
    ],
    ariaLabel: 'Eye-movement type comparison',
  }
  return {
    component: BarPlotFigure,
    props: props as unknown as Record<string, unknown>,
  }
}
