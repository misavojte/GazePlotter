import { formatParamReadout, formatProjectionReadout, type Metric, type MetricInstance } from '$lib/metrics'

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
const QUALIFIER_SEPARATOR = ' · '

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
 * The instance's DERIVED qualifier tail for a plot axis/legend — its full param
 * readout (`formatParamReadout`, the same the metric selector shows, so panel and
 * figure agree and exports self-document; this already includes an explicit
 * group-aggregation override), plus the projection when `includeProjection`
 * (aggregate plots; omit for time-axis plots whose window already lives on the
 * time axis). Always derived, so a rename never drops these.
 */
export function metricQualifiers(
  instance: MetricInstance | null | undefined,
  includeProjection = false
): string[] {
  if (!instance) return []
  const qualifiers = [...formatParamReadout(instance)]
  if (includeProjection) {
    const projection = formatProjectionReadout(instance)
    if (projection) qualifiers.push(projection)
  }
  return qualifiers
}

export interface MetricLabelOptions {
  /** Fallback quantity name when no instance/metric resolves. */
  fallback?: string
  /** Append the projection readout (aggregate plots). Omit for time-axis plots
   *  whose window already lives on the time axis (avoids printing it twice). */
  includeProjection?: boolean
  /** Append the IUPAC unit after the quantity. Default `true`; pass `false` for an
   *  axis carrying several metrics of differing units (correlation rows/cols). */
  unit?: boolean
  /** Plot-specific trailing qualifiers (statistic, "No-AOI excluded", time range). */
  extra?: Array<string | null | undefined | false>
}

/**
 * THE single builder for a metric-instance label — every plot calls this, so the
 * composition is identical everywhere:
 *
 *     <quantity>[ / <unit>] · <param qualifiers>[ · <projection>] · <plot extras>
 *
 * Per-plot differences are DATA (the options), never branching code in each plot.
 * The quantity is the (renamable) instance name; unit + qualifiers are derived,
 * so a rename can't drop them.
 */
export function buildMetricLabel(
  instance: MetricInstance | null | undefined,
  metric: Metric | null | undefined,
  opts: MetricLabelOptions = {}
): string {
  const primary =
    opts.unit === false
      ? instance?.label?.trim() || metric?.meta.label?.trim() || opts.fallback || 'Value'
      : formatInstanceLabel(instance, metric, opts.fallback)
  return withQualifiers(
    primary,
    ...metricQualifiers(instance, opts.includeProjection ?? false),
    ...(opts.extra ?? [])
  )
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
