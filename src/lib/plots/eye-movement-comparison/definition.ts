import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import {
  DIRECTION_OPTIONS,
  ORIENTATION_OPTIONS,
  OVERLAY_OPTIONS,
  overlaySummaryLabel,
} from '$lib/plots/bar/const'
import { deriveEyeMovementComparisonView } from './core/view'
import { METRIC_LABELS } from './core/const'
import type {
  EyeMovementComparisonSettings,
  EyeMovementMetric,
} from './types'

/**
 * Per-type comparison of eye-movement metrics (fixations vs saccades vs
 * blinks vs whatever the dataset records), rendered through the AOI
 * Comparison's figure. The metric is the plot's own fixed enum — it builds
 * metric-instance literals internally, so it declares no `consumesMetrics`
 * and stays out of the metric-library flow, but the pane section keeps the
 * universal 'Metric' name.
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
    {
      key: 'eyeMovementComparison:metric',
      title: 'Metric',
      fields: [
        {
          kind: 'enum',
          key: 'metric',
          label: 'Metric',
          options: (
            Object.entries(METRIC_LABELS) as [EyeMovementMetric, string][]
          ).map(([value, label]) => ({ label, value })),
        },
      ],
      summary: ctx => {
        const metric = ctx.common(s => s.metric)
        if (metric.mixed) return 'Mixed'
        return METRIC_LABELS[metric.value as EyeMovementMetric] ?? ''
      },
    },
    {
      key: 'eyeMovementComparison:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'statisticalOverlay',
          label: 'Statistical overlay',
          options: OVERLAY_OPTIONS,
        },
        {
          kind: 'enum',
          key: 'barPlottingType',
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
        const orientation = ctx.common(s => s.barPlottingType)
        const overlay = ctx.common(s => s.statisticalOverlay)
        if (orientation.mixed || overlay.mixed) return 'Mixed'
        const o = orientation.value === 'horizontal' ? 'Horizontal' : 'Vertical'
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
    metric: 'count',
    barPlottingType: 'horizontal',
    orderBy: 'type',
    orderDirection: 'asc',
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
    timelineStart: 0,
    timelineEnd: 0,
  }),
  requireCapabilities: ['segmented'],
})
