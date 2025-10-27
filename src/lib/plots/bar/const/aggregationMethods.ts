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
    label: 'Absolute times',
  },
  {
    value: 'relativeTime',
    label: 'Relative times',
  },
  {
    value: 'averageEntries',
    label: 'Mean visits',
  },
  {
    value: 'avgDwellDuration',
    label: 'Mean visit durations',
  },
  {
    value: 'averageFixationCount',
    label: 'Mean fixation couns',
  },
  {
    value: 'avgFixationDuration',
    label: 'Mean fixation durations',
  },
  {
    value: 'timeToFirstFixation',
    label: 'Mean times to first fixation',
  },
  {
    value: 'avgFirstFixationDuration',
    label: 'Mean first fixation durations',
  },
  {
    value: 'hitRatio',
    label: 'Hit ratios (seen %)',
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
