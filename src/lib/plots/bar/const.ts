// Bar Plot Aggregation Methods Registry
// This centralized registry ensures type safety and maintainability
// Optimized to directly match Select component expectations

/**
 * Registry of all available aggregation methods for bar plots
 * Structured to directly work with Select component
 * Add new methods here to automatically make them available throughout the application
 */
export const BAR_PLOT_AGGREGATION_METHODS = [
  {
    value: 'absoluteTime',
    label: 'Absolute times',
    unit: 'ms',
  },
  {
    value: 'relativeTime',
    label: 'Relative times',
    unit: '%',
  },
  {
    value: 'averageEntries',
    label: 'Mean visits',
    unit: 'count',
  },
  {
    value: 'avgDwellDuration',
    label: 'Mean visit durations',
    unit: 'ms',
  },
  {
    value: 'averageFixationCount',
    label: 'Mean fixation counts',
    unit: 'count',
  },
  {
    value: 'avgFixationDuration',
    label: 'Mean fixation durations',
    unit: 'ms',
  },
  {
    value: 'timeToFirstFixation',
    label: 'Mean times to first fixation',
    unit: 'ms',
  },
  {
    value: 'avgFirstFixationDuration',
    label: 'Mean first fixation durations',
    unit: 'ms',
  },
  {
    value: 'hitRatio',
    label: 'Hit ratios (seen)',
    unit: '%',
  },
] as const

/**
 * Inferred type for aggregation method IDs
 * Automatically derived from the registry above
 */
export type BarPlotAggregationMethodId =
  (typeof BAR_PLOT_AGGREGATION_METHODS)[number]['value']

/**
 * Utility function to get aggregation method label by value
 */
export function getAggregationMethodLabel(
  value: BarPlotAggregationMethodId
): string {
  const method = BAR_PLOT_AGGREGATION_METHODS.find(m => m.value === value)
  return method?.label || value
}

/**
 * Utility function to generate the full axis label for the bar plot including metric, unit and time range
 */
export function getBarPlotAxisLabel(
  methodId: BarPlotAggregationMethodId,
  timelineStart = 0,
  timelineEnd = 0
): string {
  const method = BAR_PLOT_AGGREGATION_METHODS.find(m => m.value === methodId)
  if (!method) return methodId

  let label = `${method.label} [${method.unit}]`

  if (timelineStart > 0 && timelineEnd > 0) {
    label += `, t ∈ [${timelineStart}, ${timelineEnd}] ms`
  } else if (timelineStart > 0) {
    label += `, t ≥ ${timelineStart} ms`
  } else if (timelineEnd > 0) {
    label += `, t ≤ ${timelineEnd} ms`
  }

  return label
}
