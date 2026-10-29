import { getAois } from '$lib/data/engine'
import type { PlotMetricContract } from '$lib/metrics'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'

/**
 * AOI-vector instances only: the metric IS the per-AOI vector, and this plot
 * draws the whole vector as one distribution per AOI (identity projection).
 * Single AOIs are a `pick-aoi` projection concern on scalar plots.
 */
export const AOI_COMPARISON_CONTRACT = {
  outputShape: 'aoi-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

export type AoiComparisonSettings = DistributionPlotSettings<'aoi'> & {
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
  hideNoAoi?: boolean
}

/**
 * Per-AOI comparison of a metric: one distribution per AOI of the plot's AOI
 * SELECTION, plus the No-AOI slot.
 */
export const aoiComparisonDefinition = defineDistributionPlot<
  'aoiComparison',
  AoiComparisonSettings
>({
  type: 'aoiComparison',
  name: 'AOI Comparison',
  tagline: 'A metric per AOI across participants',
  group: 'per-aoi',
  contract: AOI_COMPARISON_CONTRACT,
  categoryOrder: { label: 'AOI order', value: 'aoi' },
  selectionSection: 'aoi',
  defaults: { metricInstanceIds: ['absoluteTime'], hideNoAoi: false },
  requireCapabilities: ['segmented'],
  syncValueAxis: true,
  disclosures: {
    itemTooltipKey: 'AOI',
    cannotFitHints: ['Merge some AOIs in Plot Settings > Areas of Interest'],
    ariaLabel: 'AOI metrics visualization',
  },
  // One slot per AOI of the selection, then the No-AOI pseudo-slot unless
  // `hideNoAoi` drops it. Slot indices are the vector indices the result is
  // indexed by, so the No-AOI slot is always `aois.length`, never a renumbering.
  axis: (engine, settings) => {
    const meta = engine.metadata
    if (!meta) throw new Error('No metadata found')
    const aois = getAois(engine, settings.stimulusId, settings.aoiSelectionId)
    const slots = entitySlots(aois.map((aoi, slot) => ({ ...aoi, slot })))
    if (!(settings.hideNoAoi ?? false)) {
      slots.push({
        slot: aois.length,
        label: meta.noAoiTreatment.displayedName,
        color: meta.noAoiTreatment.color,
      })
    }
    return { slots, ...distributionParticipants(engine, settings) }
  },
})
