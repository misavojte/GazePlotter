// Bar Plot Aggregation Methods Registry
// This centralized registry ensures type safety and maintainability
// Optimized to directly match GeneralSelect component expectations

/**
 * Registry of all available aggregation methods for bar plots
 * Structured to directly work with GeneralSelect component
 * Add new methods here to automatically make them available throughout the application
 */
export const BAR_PLOT_AGGREGATION_METHODS = [
  {
    value: 'absoluteTime',
    label: 'Absolute Time',
  },
  {
    value: 'relativeTime',
    label: 'Relative Time',
  },
  {
    value: 'timeToFirstFixation',
    label: 'Time to First Fixation',
  },
  {
    value: 'avgFixationDuration',
    label: 'Avg Fixation Duration',
  },
  {
    value: 'avgFirstFixationDuration',
    label: 'Avg First Fixation Duration',
  },
  {
    value: 'averageFixationCount',
    label: 'Avg Fixation Count',
  },
  {
    value: 'hitRatio',
    label: 'Hit ratio (seen %)',
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
