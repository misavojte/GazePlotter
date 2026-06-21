import type { Metric, MetricInstance } from '$lib/metrics'

/**
 * Axis / legend / colorbar label grammar — ONE format for every plot.
 *
 * A label is a **quantity** optionally followed by **shaping qualifiers**:
 *
 *     <Quantity> / <unit> · <qualifier> · <qualifier> · …
 *
 *   - The quantity + unit use the IUPAC quantity/unit convention
 *     (`"Absolute dwell time / ms"`, `"Transition probability / %"`); the
 *     `/ unit` is dropped when the quantity is dimensionless.
 *   - Shaping qualifiers (window/step, "No-AOI excluded", a statistic, a
 *     correlation N, a sub-stimulus time range, …) trail behind, each joined
 *     by a mid-dot. This is the same separator the metrics layer already uses
 *     for projection/window readouts (`projectionToLabel`, `windowLabel`,
 *     `defaultInstanceLabel`), so a metric instance label and a plot label
 *     read as one continuous grammar.
 *
 * NEVER use brackets `[unit]`, parentheticals `(qualifier)`, or ad-hoc
 * comma/semicolon clauses — those were the inconsistencies this module
 * replaces. Every plot routes its axis/legend/colorbar text through here so
 * the format is identical everywhere; only the inputs differ to reflect a
 * plot's real semantics (a time-series plot puts its binning window on the
 * time axis; an aggregate plot puts the metric's projection in the quantity).
 */

/** The mid-dot qualifier separator. Shared with the metrics-layer readouts. */
export const QUALIFIER_SEPARATOR = ' · '

/**
 * IUPAC quantity/unit: `"<quantity> / <unit>"`, or just `"<quantity>"` when the
 * unit is empty. Whitespace is trimmed so callers can pass raw metric fields.
 */
export function formatQuantity(quantity: string, unit?: string | null): string {
  const q = quantity.trim()
  const u = (unit ?? '').trim()
  return u ? `${q} / ${u}` : q
}

/**
 * Quantity label for a `Metric` — the bare, generic quantity name + unit
 * (`meta.label` / `meta.unit`). Use for value axes whose quantity is the metric
 * itself and whose shaping (window, projection) is disclosed elsewhere
 * (e.g. the time axis of aoi-stream / evolving-metrics). `null` → `"Value"` so
 * a figure never renders a blank axis.
 */
export function formatMetricLabel(metric: Metric | null | undefined): string {
  if (!metric) return 'Value'
  return formatQuantity(metric.meta.label, metric.meta.unit)
}

/**
 * Quantity label for a resolved metric INSTANCE + its metric: the instance's
 * display name (which already carries projection/mode/window qualifiers via the
 * metrics-layer mid-dot grammar, and is user-renamable) + the metric's unit.
 * Use for aggregate plots (transition matrix, bar, similarity, …) where the
 * projection is part of the quantity's identity. Falls back to the metric's
 * generic name, then `fallback`, when no instance is resolved.
 */
export function formatInstanceLabel(
  instance: MetricInstance | null | undefined,
  metric: Metric | null | undefined,
  fallback = 'Value'
): string {
  const name = instance?.label?.trim() || metric?.meta.label?.trim()
  if (!name) return fallback
  return formatQuantity(name, metric?.meta.unit ?? '')
}

/**
 * Append shaping qualifiers to a primary label with the mid-dot grammar.
 * Falsy / blank qualifiers are dropped, so callers can pass conditionals
 * inline (`hideNoAoi && 'No-AOI excluded'`, `timeRangeQualifier(a, b)`).
 */
export function withQualifiers(
  primary: string,
  ...qualifiers: Array<string | null | undefined | false>
): string {
  const present = qualifiers.filter(
    (q): q is string => typeof q === 'string' && q.trim().length > 0
  )
  return present.length
    ? `${primary}${QUALIFIER_SEPARATOR}${present.join(QUALIFIER_SEPARATOR)}`
    : primary
}

/**
 * Interval qualifier in math notation: `"<symbol> ∈ [a, b] <unit>"`,
 * `"<symbol> ≥ a <unit>"`, `"<symbol> ≤ b <unit>"`, or `null` when no bound is
 * set. The trailing unit is plain (`"100 ms"`) — this is an interval
 * expression, not an IUPAC quantity/unit, so it does NOT use the `/` separator.
 */
export function rangeQualifier(
  symbol: string,
  start = 0,
  end = 0,
  unit = ''
): string | null {
  const u = unit ? ` ${unit}` : ''
  if (start > 0 && end > 0) return `${symbol} ∈ [${start}, ${end}]${u}`
  if (start > 0) return `${symbol} ≥ ${start}${u}`
  if (end > 0) return `${symbol} ≤ ${end}${u}`
  return null
}

/**
 * Sub-stimulus time-range qualifier (`"t ∈ [100, 5000] ms"`, …), or `null` when
 * unbounded. Signals that a metric was computed over a stimulus sub-extent, not
 * the full recording — disclose it wherever a clipped range is otherwise
 * invisible (aggregate plots; a time axis with a non-default extent).
 */
export function timeRangeQualifier(start = 0, end = 0): string | null {
  return rangeQualifier('t', start, end, 'ms')
}
