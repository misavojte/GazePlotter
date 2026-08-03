import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { resolvePickedInstance } from '$lib/plots/shared'
import {
  deriveDistributionFigure,
  type DistributionDisclosures,
} from '$lib/plots/shared/distribution/figure'
import { getAoiComparisonData } from './transformer'
import type { AoiComparisonSettings } from '../types'

/**
 * This plot's entity vocabulary on the shared figure: what a category slot IS,
 * how to make the figure fit, and how a screen reader names it. Passed
 * explicitly — the figure serves several plots, so it must not speak AOI by
 * default.
 */
const AOI_DISCLOSURES: DistributionDisclosures = {
  itemTooltipKey: 'AOI',
  cannotFitHints: ['Merge some AOIs in Plot Settings > Areas of Interest'],
  ariaLabel: 'AOI metrics visualization',
}

/**
 * The `definePlot` view entry — the single derivation for screen and export.
 * `props.timeline` is the UNSYNCED timeline; the on-screen container may swap in
 * a synced one off `meta` (export never syncs).
 */
export function deriveAoiComparisonView(
  engine: DataEngine,
  settings: AoiComparisonSettings
): PlotView {
  return deriveDistributionFigure(
    getAoiComparisonData(engine, settings),
    resolvePickedInstance(engine, settings.metricInstanceIds),
    settings,
    AOI_DISCLOSURES
  )
}
