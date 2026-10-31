import { applyCategorySelection } from '$lib/data/engine'
import { categoryGroups } from '$lib/metrics'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'

export type EyeMovementComparisonSettings = DistributionPlotSettings<'type'> & {
  /** Per-plot eye-movement-type SELECTION id; unset/0 = all types. */
  categorySelectionId?: number
}

/** One distribution per eye-movement type, narrowed by the plot's type SELECTION. */
export const eyeMovementComparisonDefinition = defineDistributionPlot<
  'eyeMovementComparison',
  EyeMovementComparisonSettings
>({
  type: 'eyeMovementComparison',
  name: 'Eye-movement Comparison',
  tagline: 'A metric per eye-movement type',
  group: 'gaze-behavior',
  // The metric IS the per-type vector, drawn whole; single types are a
  // `pick-category` projection on scalar plots.
  contract: { outputShape: 'category-vector', windowing: 'forbidden', crossParticipant: 'distribution' },
  categoryOrder: { label: 'Type order', value: 'type' },
  selectionSection: 'eyeMovement',
  defaults: { metricInstanceIds: ['movementDuration'] },
  requireCapabilities: ['segmented'],
  disclosures: {
    itemTooltipKey: 'Type',
    cannotFitHints: ['Select fewer types in Plot Settings > Eye-movement Types'],
    ariaLabel: 'Eye-movement type comparison',
  },
  // Canonical `categoryGroups` order, the vectors' index order, so each group
  // keeps its slot; narrowed by the scarf's `applyCategorySelection` gate.
  // Fixation is an ordinary group, so "Just fixations" leaves exactly one slot.
  axis: (engine, settings) => {
    const axis = categoryGroups(engine).map((g, slot) => ({ ...g, slot }))
    const { kept } = applyCategorySelection(engine, axis, settings.categorySelectionId)
    return { slots: entitySlots(kept), ...distributionParticipants(engine, settings) }
  },
})
