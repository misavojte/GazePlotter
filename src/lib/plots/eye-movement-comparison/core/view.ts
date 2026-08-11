import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { resolvePickedInstance } from '$lib/plots/shared'
import {
  deriveDistributionFigure,
  type DistributionDisclosures,
} from '$lib/plots/shared/distribution/figure'
import { getEyeMovementComparisonData } from './transformer'
import type { EyeMovementComparisonSettings } from '../types'

/** This plot's entity vocabulary on the shared figure — a slot is a TYPE. */
const TYPE_DISCLOSURES: DistributionDisclosures = {
  itemTooltipKey: 'Type',
  cannotFitHints: ['Select fewer types in Plot Settings > Eye-movement Types'],
  ariaLabel: 'Eye-movement type comparison',
}

/**
 * The `definePlot` view entry — the single derivation for screen and export,
 * off the SAME seam as the AOI Comparison, so the axis label, the
 * proportion/overlay rule and the figure geometry cannot drift between the two
 * plots; only the three disclosure strings differ.
 */
export function deriveEyeMovementComparisonView(
  engine: DataEngine,
  settings: EyeMovementComparisonSettings
): PlotView {
  return deriveDistributionFigure(
    getEyeMovementComparisonData(engine, settings),
    resolvePickedInstance(engine, settings.metricInstanceIds),
    settings,
    TYPE_DISCLOSURES
  )
}
