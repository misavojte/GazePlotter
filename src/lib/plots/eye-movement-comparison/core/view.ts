import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import BarPlotFigure from '$lib/plots/bar/components/BarPlotFigure.svelte'
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
  return {
    component: BarPlotFigure,
    props: {
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
    } as Record<string, unknown>,
  }
}
