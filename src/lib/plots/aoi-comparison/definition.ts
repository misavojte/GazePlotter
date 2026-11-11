import { getAois } from '$lib/data/engine'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'
import { prefixedHighlights } from '$lib/plots/shared/highlightLink'
import { reconcileStimulusScopedHighlights } from '$lib/plots/shared/highlightReconcile'

/** No AOI's highlight id, as in the AOI Timeline and Transition Matrix. */
const NO_AOI_ID = '-1'

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
  group: 'metric',
  keywords: 'dwell time TTFF time to first fixation visits',
  // The metric IS the per-AOI vector, drawn whole; single AOIs are a `pick-aoi`
  // projection on scalar plots.
  contract: { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' },
  categoryOrder: { label: 'AOI order', value: 'aoi' },
  selectionSection: 'aoi',
  defaults: { metricInstanceIds: ['absoluteTime'], hideNoAoi: false },
  requireCapabilities: ['segmented'],
  syncValueAxis: true,
  // Highlights are bare AOI ids, as in the AOI Timeline.
  highlights: prefixedHighlights({ aoi: '', noAoi: NO_AOI_ID }),
  onCommand: reconcileStimulusScopedHighlights<AoiComparisonSettings>(
    () => true,
    (engine, s) => [...getAois(engine, s.stimulusId).map(a => String(a.id)), NO_AOI_ID]
  ),
  disclosures: {
    itemTooltipKey: 'AOI',
    cannotFitHints: ['Merge some AOIs in Plot Settings > Areas of Interest'],
    emptyPlaceholder: {
      message: 'No AOIs to show on this stimulus.',
      steps: ['Pick another Stimulus or a selection in Areas of Interest'],
    },
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
      slots.push({ slot: aois.length, id: NO_AOI_ID, label, color })
    }
    return { slots, ...distributionParticipants(engine, settings) }
  },
})
