import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import { distributionVisualisationSection } from '$lib/plots/shared/distribution/paneSection'
import { EYE_MOVEMENT_COMPARISON_CONTRACT } from './core/transformer'
import { deriveEyeMovementComparisonView } from './core/view'
import type { EyeMovementComparisonSettings } from './types'

/**
 * Per-type comparison of eye-movement metrics (fixations vs saccades vs blinks
 * vs whatever the dataset records), rendered through the shared distribution
 * layer. The Metric section is the SAME library flow every metric plot uses;
 * the contract admits category-vector instances at identity, and the plot draws
 * the instance's whole vector — one distribution per type on the canonical
 * `categoryGroups` axis, narrowed by the per-plot eye-movement-type SELECTION.
 * Single types are a `pick-category` projection concern on scalar plots, never
 * anything this plot configures.
 *
 * No `screen` recipe: this plot does not sync its value axis across siblings
 * today. Its view already carries the meta for it, so opting in is adding
 * `screen: distributionValueAxisScreen()` and nothing else.
 */
export const eyeMovementComparisonDefinition = definePlot<
  'eyeMovementComparison',
  EyeMovementComparisonSettings
>({
  type: 'eyeMovementComparison',
  name: 'Eye-movement Comparison',
  group: 'gaze-behavior',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    distributionVisualisationSection({
      key: 'eyeMovementComparison:visualisation',
      categoryOrder: { label: 'Type order', value: 'type' },
    }),
    'timelineRange',
    'eyeMovement',
  ],
  view: { deriveView: deriveEyeMovementComparisonView },
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['movementDuration'],
    orientation: 'horizontal',
    orderBy: 'type',
    orderDirection: 'asc',
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
    timelineStart: 0,
    timelineEnd: 0,
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: EYE_MOVEMENT_COMPARISON_CONTRACT,
})
