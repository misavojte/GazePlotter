import { applyCategorySelection } from '$lib/data/engine'
import { categoryGroups, type PlotMetricContract } from '$lib/metrics'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'

/**
 * Category-vector instances only: the metric IS the per-type vector, and this
 * plot draws the whole vector as one distribution per type (identity
 * projection). Single types are a `pick-category` projection concern on scalar
 * plots, never a parameter.
 */
export const EYE_MOVEMENT_COMPARISON_CONTRACT = {
  outputShape: 'category-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

export type EyeMovementComparisonSettings = DistributionPlotSettings<'type'> & {
  /** Per-plot eye-movement-type SELECTION id; unset/0 = all types. */
  categorySelectionId?: number
}

/**
 * Per-type comparison of eye-movement metrics (fixations vs saccades vs blinks
 * vs whatever the dataset records): one distribution per type on the canonical
 * `categoryGroups` axis, narrowed by the plot's eye-movement-type SELECTION.
 */
export const eyeMovementComparisonDefinition = defineDistributionPlot<
  'eyeMovementComparison',
  EyeMovementComparisonSettings
>({
  type: 'eyeMovementComparison',
  name: 'Eye-movement Comparison',
  tagline: 'A metric per eye-movement type',
  group: 'gaze-behavior',
  contract: EYE_MOVEMENT_COMPARISON_CONTRACT,
  categoryOrder: { label: 'Type order', value: 'type' },
  selectionSection: 'eyeMovement',
  defaults: { metricInstanceIds: ['movementDuration'] },
  requireCapabilities: ['segmented'],
  disclosures: {
    itemTooltipKey: 'Type',
    cannotFitHints: ['Select fewer types in Plot Settings > Eye-movement Types'],
    ariaLabel: 'Eye-movement type comparison',
  },
  // The canonical `categoryGroups` order (the order the recipes' vectors are
  // indexed by, so each group keeps its slot), narrowed by the same
  // `applyCategorySelection` gate the scarf uses. Fixation is in the axis like
  // any other group, so the seeded "Just fixations" row leaves exactly one slot.
  axis: (engine, settings) => {
    const axis = categoryGroups(engine).map((g, slot) => ({ ...g, slot }))
    const { kept } = applyCategorySelection(engine, axis, settings.categorySelectionId)
    return { slots: entitySlots(kept), ...distributionParticipants(engine, settings) }
  },
})
