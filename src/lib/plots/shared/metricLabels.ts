import type { Metric } from '$lib/metrics'

/**
 * Format a metric's display label for an axis or legend title — `"<label>
 * [<unit>]"` when both fields are present, falling back gracefully:
 *
 *   - `Metric` with label "Absolute dwell time" + unit "ms" →
 *     `"Absolute dwell time [ms]"`
 *   - `Metric` with label "Foo" + empty unit → `"Foo"`
 *   - `null` / `undefined` metric → `"Value"` (neutral fallback so figures
 *     never render a blank axis)
 *
 * Centralised here so every plot renders metric titles identically.
 * Consumers: aoi-stream and evolving-metrics transformers.
 */
export function formatMetricLabel(metric: Metric | null | undefined): string {
  if (!metric) return 'Value'
  const { label, unit } = metric.meta
  return unit ? `${label} [${unit}]` : label
}
