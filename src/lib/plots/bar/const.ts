import { getMetric, type MetricInstance } from '$lib/metrics'
import type { StatisticalOverlayType } from './types'

export const BAR_PLOT_AGGREGATION_METHODS = [
  {
    value: 'absoluteTime',
    label: 'Absolute dwell time',
    unit: 'ms',
  },
  {
    value: 'relativeTime',
    label: 'Relative dwell time',
    unit: '%',
  },
  {
    value: 'averageEntries',
    label: 'Visit count',
    unit: 'count',
  },
  {
    value: 'avgDwellDuration',
    label: 'Visit duration',
    unit: 'ms',
  },
  {
    value: 'averageFixationCount',
    label: 'Fixation count',
    unit: 'count',
  },
  {
    value: 'avgFixationDuration',
    label: 'Fixation duration',
    unit: 'ms',
  },
  {
    value: 'timeToFirstFixation',
    label: 'Time to first fixation',
    unit: 'ms',
  },
  {
    value: 'avgFirstFixationDuration',
    label: 'First fixation duration',
    unit: 'ms',
  },
] as const

export type BarPlotAggregationMethodId =
  (typeof BAR_PLOT_AGGREGATION_METHODS)[number]['value']

/**
 * Generate the bar plot axis label for a resolved metric instance.
 *
 * Scientific bracket notation: `${label} [unit, stat indicator]`
 * with an optional `, t ∈ [start, end] ms` time-range suffix.
 */
export function getBarPlotAxisLabel(
  instance: MetricInstance | null | undefined,
  timelineStart = 0,
  timelineEnd = 0,
  overlay: StatisticalOverlayType = 'none'
): string {
  if (!instance) return ''
  const metric = getMetric(instance.baseId)
  const unit = metric?.meta.unit ?? ''

  let bracketContent = unit
  if (overlay === 'meanSd') {
    bracketContent += bracketContent ? ', x̄ ± SD' : 'x̄ ± SD'
  } else if (overlay === 'meanCi95') {
    bracketContent += bracketContent ? ', x̄ ± 95% CI' : 'x̄ ± 95% CI'
  } else if (overlay === 'boxplot') {
    bracketContent += bracketContent ? ', x̃/IQR' : 'x̃/IQR'
  }

  let label = bracketContent
    ? `${instance.label} [${bracketContent}]`
    : instance.label

  if (timelineStart > 0 && timelineEnd > 0) {
    label += `, t ∈ [${timelineStart}, ${timelineEnd}] ms`
  } else if (timelineStart > 0) {
    label += `, t ≥ ${timelineStart} ms`
  } else if (timelineEnd > 0) {
    label += `, t ≤ ${timelineEnd} ms`
  }

  return label
}
