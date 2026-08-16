import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { resolvePickedInstance } from '$lib/plots/shared'
import {
  deriveDistributionFigure,
  type DistributionDisclosures,
} from '$lib/plots/shared/distribution/figure'
import { getEventComparisonData } from './transformer'
import type { EventComparisonSettings } from '../types'

/** This plot's entity vocabulary on the shared figure — a slot is a CHANNEL. */
const EVENT_DISCLOSURES: DistributionDisclosures = {
  itemTooltipKey: 'Event',
  cannotFitHints: ['Select fewer event channels in Plot Settings > Events'],
  ariaLabel: 'Event channel comparison',
}

/**
 * The `definePlot` view entry — the single derivation for screen and export,
 * off the SAME seam as the other comparison plots, so the axis label, the
 * proportion/overlay rule and the figure geometry cannot drift; only the
 * three disclosure strings differ.
 */
export function deriveEventComparisonView(
  engine: DataEngine,
  settings: EventComparisonSettings
): PlotView {
  return deriveDistributionFigure(
    getEventComparisonData(engine, settings),
    resolvePickedInstance(engine, settings.metricInstanceIds),
    settings,
    EVENT_DISCLOSURES
  )
}
