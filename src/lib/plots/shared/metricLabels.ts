import type { Metric } from '$lib/metrics'

/**
 * Format a metric's display label for an axis or legend title using the
 * IUPAC quantity/unit convention — `"<label> / <unit>"` when both fields
 * are present:
 *
 *   - label "Absolute dwell time" + unit "ms" → `"Absolute dwell time / ms"`
 *   - label "Foo" + empty unit → `"Foo"`
 *   - `null` / `undefined` metric → `"Value"` (neutral fallback so figures
 *     never render a blank axis)
 *
 * Axes carry the bare quantity name + unit only — shaping params (window,
 * projection, AOI pick, …) belong on the plot title/legend, not the axis.
 * Centralised here so every plot renders metric titles identically.
 * Consumers: aoi-stream and evolving-metrics transformers.
 */
export function formatMetricLabel(metric: Metric | null | undefined): string {
  if (!metric) return 'Value'
  const { label, unit } = metric.meta
  return unit ? `${label} / ${unit}` : label
}
