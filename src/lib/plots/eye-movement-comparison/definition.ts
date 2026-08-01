import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
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
          options: [
            { label: 'None', value: 'none' },
            { label: 'Mean ± 95% CI', value: 'meanCi95' },
            { label: 'Mean ± SD', value: 'meanSd' },
            { label: 'Boxplot', value: 'boxplot' },
          ],
        },
        {
          kind: 'enum',
          key: 'barPlottingType',
          label: 'Orientation',
          options: [
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ],
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
          options: [
            { label: 'ASC', value: 'asc' },
            { label: 'DESC', value: 'desc' },
          ],
        },
        { kind: 'scaleRange', key: 'scaleRange', legend: 'Scale range' },
      ],
      summary: ctx => {
        const orientation = ctx.common(s => s.barPlottingType)
        const overlay = ctx.common(s => s.statisticalOverlay)
        if (orientation.mixed || overlay.mixed) return 'Mixed'
        const o = orientation.value === 'horizontal' ? 'Horizontal' : 'Vertical'
        const ov =
          overlay.value === 'none'
            ? 'No overlay'
            : overlay.value === 'meanCi95'
              ? 'M ± 95% CI'
              : overlay.value === 'meanSd'
                ? 'M ± SD'
                : 'Boxplot'
        return `${o} (${ov})`
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
