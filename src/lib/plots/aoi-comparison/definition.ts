import { getAois } from '$lib/data/engine'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'

export type AoiComparisonSettings = DistributionPlotSettings<'aoi'> & {
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
  hideNoAoi?: boolean
}

/** One distribution per AOI of the plot's AOI SELECTION, plus the No-AOI slot. */
export const aoiComparisonDefinition = defineDistributionPlot<
  'aoiComparison',
  AoiComparisonSettings
>({
  type: 'aoiComparison',
  name: 'AOI Comparison',
  tagline: 'A metric per AOI across participants',
  group: 'per-aoi',
  // The metric IS the per-AOI vector, drawn whole; single AOIs are a `pick-aoi`
  // projection on scalar plots.
  contract: { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' },
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
  // Slot indices are the vector indices, so the No-AOI slot is always
  // `aois.length`, never a renumbering.
  axis: (engine, settings) => {
    const meta = engine.metadata
    if (!meta) throw new Error('No metadata found')
    const aois = getAois(engine, settings.stimulusId, settings.aoiSelectionId)
    const slots = entitySlots(aois.map((aoi, slot) => ({ ...aoi, slot })))
    if (!settings.hideNoAoi) {
      const { displayedName: label, color } = meta.noAoiTreatment
      slots.push({ slot: aois.length, label, color })
    }
    return { slots, ...distributionParticipants(engine, settings) }
  },
})
