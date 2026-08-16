import {
  getMetric,
  queryPooledIndividuals,
  type PlotMetricContract,
} from '$lib/metrics'
import {
  resolveMetric,
  type MetricResolutionEngine,
} from '$lib/plots/shared/metricResolver'
import { formatDecimal } from '$lib/shared/utils/mathUtils'
import { applySorting, valueAxisTimeline } from './data'
import { computeSummaryStatistics } from './summaryStatistics'
import type {
  CategoryDistribution,
  DistributionAxis,
  DistributionResult,
  StatisticalOverlayType,
} from './types'

/**
 * The settings a distribution reads. Declared HERE rather than Picked from one
 * plot's settings type — this layer must not depend on either consumer; both
 * plots' settings satisfy it structurally.
 */
export interface DistributionSettings {
  metricInstanceIds?: string[]
  /** `'value'` sorts by the bar value; anything else keeps the axis order. */
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  scaleRange?: [number, number]
  statisticalOverlay?: StatisticalOverlayType
}

/**
 * THE distribution derivation — one distribution per category slot — shared by
 * every plot that renders one (AOI Comparison, Eye-movement Comparison). The
 * plot supplies only its contract and its axis; this owns the whole rest of the
 * pipeline, so the two plots cannot drift on any of it:
 *
 *  - metric resolution + the `noMetric` placeholder path;
 *  - the PROPORTION rule (a `[0,1]` rate renders as a plain proportional bar,
 *    never a beeswarm of 0/1 dots) read off the metric's declared class;
 *  - the beeswarm pooling rule (see `queryPooledIndividuals`): one scan per
 *    participant, every event its own dot for metrics with an `individuals`
 *    recipe, per-slot fallback to the cached aggregate for the rest;
 *  - the per-slot summary statistics and the bar value (always the plain mean
 *    of individuals — every metric's values already match its declared unit,
 *    so there is no per-class scaling);
 *  - ordering, and the value-axis maximum: proportion bars scan the drawn bar
 *    values, distributions scan the raw dots (plus whiskers under a boxplot
 *    overlay).
 *
 * `axis` is a thunk: it is built only once a metric resolved, so an unpicked or
 * contract-failing instance costs no engine queries.
 */
export function collectDistribution(args: {
  engine: MetricResolutionEngine
  contract: PlotMetricContract
  settings: DistributionSettings
  axis: () => DistributionAxis
}): DistributionResult {
  const emptyResult = (): DistributionResult => ({
    data: [],
    timeline: valueAxisTimeline(0, undefined),
    dataMax: 0,
  })

  const resolved = resolveMetric({
    engine: args.engine,
    id: args.settings.metricInstanceIds?.[0] ?? null,
    contract: args.contract,
  })
  if (!resolved.ok) return { ...emptyResult(), noMetric: true }
  const { instance } = resolved
  const proportion =
    getMetric(instance.baseId)?.meta.measurementClass === 'proportion'

  const axis = args.axis()
  if (axis.scopes.length === 0) return emptyResult()

  const pooled = queryPooledIndividuals(
    instance,
    axis.scopes,
    axis.participantNames,
    axis.slots.map(s => s.slot)
  )

  const data: CategoryDistribution[] = axis.slots.map((slot, i) => {
    const values = pooled.values[i]
    const stats = computeSummaryStatistics(values)
    return {
      value: formatDecimal(stats.mean),
      label: slot.label,
      color: slot.color,
      stats,
      individualValues: values,
      individualParticipantNames: pooled.names[i],
    }
  })

  const overlay = args.settings.statisticalOverlay ?? 'none'
  let dataMax = 0
  if (proportion) {
    // Percent bar values; the axis is data-driven (space-efficient).
    for (const item of data) {
      if (item.value > dataMax) dataMax = item.value
    }
  } else {
    for (const item of data) {
      for (const v of item.individualValues ?? []) {
        if (v > dataMax) dataMax = v
      }
      if (overlay === 'boxplot' && item.stats && item.stats.whiskerHigh > dataMax) {
        dataMax = item.stats.whiskerHigh
      }
    }
  }

  return {
    data: applySorting(
      data,
      args.settings.orderBy,
      args.settings.orderDirection ?? 'asc'
    ),
    timeline: valueAxisTimeline(dataMax, args.settings.scaleRange),
    dataMax,
    proportion,
  }
}
