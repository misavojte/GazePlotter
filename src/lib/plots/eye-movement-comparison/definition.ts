import { definePlot } from '$lib/plots/definePlot'
import {
  pickedInstanceIsProportion as isProportion,
  stimulusGroupSubtitle,
} from '$lib/plots/shared'
import {
  DIRECTION_OPTIONS,
  ORIENTATION_OPTIONS,
  OVERLAY_OPTIONS,
  overlaySummaryLabel,
} from '$lib/plots/shared/distribution'
import { deriveEyeMovementComparisonView } from './core/view'
import { EYE_MOVEMENT_COMPARISON_CONTRACT } from './core/transformer'
import type { EyeMovementComparisonSettings } from './types'

/**
 * Per-type comparison of eye-movement metrics (fixations vs saccades vs
 * blinks vs whatever the dataset records), rendered through the shared
 * `BeeswarmFigure`. The Metric section is the SAME library flow every
 * metric plot uses; the contract admits category-vector instances at
 * identity, and the plot draws the instance's whole vector as bars — one per
 * type on the canonical `categoryGroups` axis, narrowed by the per-plot
 * eye-movement-type SELECTION. Single types are a `pick-category` projection
 * concern on scalar plots, never anything this plot configures.
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
    {
      key: 'eyeMovementComparison:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'statisticalOverlay',
          label: 'Statistical overlay',
          options: OVERLAY_OPTIONS,
          // Proportion metrics render as plain bars; the overlay does not
          // apply — the same shared gate the AOI Comparison uses. No
          // category-vector metric is proportion-class today (the time SHARE
          // is intensive, like relativeTime), so this reads as false for
          // every instance the contract currently admits; it stays because
          // the rule belongs to the metric's declared class, not to a list of
          // recipe ids.
          showWhen: ctx => !isProportion(ctx),
        },
        {
          kind: 'enum',
          key: 'orientation',
          label: 'Orientation',
          options: ORIENTATION_OPTIONS,
        },
        {
          kind: 'enum',
          key: 'orderBy',
          label: 'Order by',
          options: [
            { label: 'Value', value: 'value' },
            { label: 'Type order', value: 'type' },
          ],
        },
        {
          kind: 'enum',
          key: 'orderDirection',
          label: 'Direction',
          options: DIRECTION_OPTIONS,
        },
        { kind: 'scaleRange', key: 'scaleRange', legend: 'Scale range' },
      ],
      summary: ctx => {
        const orientation = ctx.common(s => s.orientation)
        const overlay = ctx.common(s => s.statisticalOverlay)
        const o = orientation.mixed
          ? 'Mixed'
          : orientation.value === 'horizontal'
            ? 'Horizontal'
            : 'Vertical'
        if (isProportion(ctx)) return `${o} (Bars)`
        if (orientation.mixed || overlay.mixed) return 'Mixed'
        return `${o} (${overlaySummaryLabel(String(overlay.value))})`
      },
    },
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
