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
 * Utility function to generate the full axis label for the bar plot including metric, unit and time range.
 * Uses scientific bracket notation: metric [unit, stat indicator]
 */
export function getBarPlotAxisLabel(
  methodId: BarPlotAggregationMethodId,
  timelineStart = 0,
  timelineEnd = 0,
  overlay: 'none' | 'meanCi95' | 'meanSd' | 'boxplot' = 'none'
): string {
  const method = BAR_PLOT_AGGREGATION_METHODS.find(m => m.value === methodId)
  if (!method) return methodId

  // Build bracket content: unit + optional stat indicator
  let bracketContent = method.unit
  if (overlay === 'meanSd') {
    bracketContent += ', x̄ ± SD'
  } else if (overlay === 'meanCi95') {
    bracketContent += ', x̄ ± 95% CI'
  } else if (overlay === 'boxplot') {
    bracketContent += ', x̃/IQR'
  }

  let label = `${method.label} [${bracketContent}]`

  if (timelineStart > 0 && timelineEnd > 0) {
    label += `, t ∈ [${timelineStart}, ${timelineEnd}] ms`
  } else if (timelineStart > 0) {
    label += `, t ≥ ${timelineStart} ms`
  } else if (timelineEnd > 0) {
    label += `, t ≤ ${timelineEnd} ms`
  }

  return label
}
