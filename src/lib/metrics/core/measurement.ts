/**
 * # Capability algebra over an abstract metric shape
 *
 * The single, reusable home for "can action X be performed over metric Y?" as
 * PURE LOGIC. Every function here is a total function of declarative data
 * (`MeasurementClass` + the abstract {@link MetricShape}) — no recipe callbacks,
 * no runtime-value dependence, no silent mutation. That makes the whole surface
 * enumerable by an MCP/LLM (list a metric's class, list its sound reductions,
 * pick one, and the effective result equals the request) and gives a future
 * statistics engine one place to add predicates (`canCompareGroups`,
 * `canCorrelate`, …) over the same abstraction.
 *
 * Three orthogonal aggregation axes, kept separate by design:
 *   - **within-participant shape reduction** (projection leaves) →
 *     {@link supportedAoiReducers} / {@link supportedMatrixReducers}
 *   - **cross-participant reduction** (one value per cell) →
 *     {@link soundReductions} ({@link GroupReduction})
 *   - **distribution display** (a plot-layer choice over individuals) →
 *     {@link distributionStatistics} ({@link DistributionStat})
 */
import type { MetricMeta, OutputShape, WindowUnit } from './dsl'
import {
  projectionOutputShape,
  type Projection,
  type AoiReducer,
  type MatrixReducer,
} from './projection'

/**
 * The statistical class of a metric's per-participant value. The ONE declarative
 * property that determines every aggregation capability. Replaces the former
 * scattered `additive` / `groupAggregation` / `supportsGroupAggregation` /
 * `groupAggregationGuard`.
 *
 *   - `extensive`  — a physical quantity that adds: counts, summed durations.
 *     Both a cohort total (`sum`) and a per-participant average (`mean`) are
 *     sound, and `sum`/`mean` are sound across matrix cells.
 *   - `intensive`  — a per-participant normalized value: an average, rate,
 *     percentage, probability, or latency. Only `mean` is sound across
 *     participants; summing per-participant shares is nonsense.
 *   - `proportion` — a per-participant 0/1 indicator (e.g. "was fixated"). The
 *     cross-participant value IS the fraction (a noticed-rate), numerically a
 *     mean; it also flags proportional rendering.
 *   - `relational` — a group-level quantity defined per participant *pair*
 *     (scanpath similarity). There is no per-participant value to reduce.
 */
export type MeasurementClass = 'extensive' | 'intensive' | 'proportion' | 'relational'

/**
 * A cross-participant reduction operation — collapses per-participant results
 * to one value per cell. The complete, closed set: two genuinely different
 * NUMBERS (a centre vs a cohort total). `median` is deliberately NOT here — two
 * central tendencies of the same distribution are a display choice
 * ({@link DistributionStat}), not a separate reduction.
 */
export type GroupReduction = 'mean' | 'sum'

/**
 * A distribution-display statistic — how a distribution-oriented plot (the bar
 * plot) summarises the per-participant sample it draws. Lives at the plot layer,
 * never collapses the data to a single transported number.
 */
export type DistributionStat = 'mean' | 'median' | 'ci95' | 'sd' | 'iqr'

// ─── Cross-participant reduction (axis B) ────────────────────────────────────

/**
 * The mathematically sound cross-participant reductions for a class. Total
 * function, no shape dependence, no guards. THE enumerable source the metric
 * library, the runtime, and any MCP caller all read.
 */
export function soundReductions(cls: MeasurementClass): GroupReduction[] {
  switch (cls) {
    case 'extensive':
      return ['mean', 'sum']
    case 'intensive':
    case 'proportion':
      return ['mean']
    case 'relational':
      return []
  }
}

/** Whether a class is reduced across participants at all (vs group-level). */
export function reducesAcrossParticipants(cls: MeasurementClass): boolean {
  return cls !== 'relational'
}

// ─── Distribution display (axis C) ───────────────────────────────────────────

/**
 * The distribution statistics a distribution-mode plot may offer for a class.
 * A `proportion` is a single [0,1] rate (drawn as one proportional bar, no
 * spread overlay); `relational` has no per-participant distribution.
 */
export function distributionStatistics(cls: MeasurementClass): DistributionStat[] {
  switch (cls) {
    case 'extensive':
    case 'intensive':
      return ['mean', 'median', 'ci95', 'sd', 'iqr']
    case 'proportion':
    case 'relational':
      return []
  }
}

// ─── Within-participant shape reduction (axis A) ─────────────────────────────

/**
 * `aggregate-aoi` reducers: always `max | min`. Sum/mean/median across AOIs are
 * biased by AOI count or are an average-of-averages; stimulus-level totals
 * belong in purpose-built metrics (`pick-any-fixation`). Independent of class.
 */
const AGGREGATE_AOI_REDUCERS: readonly AoiReducer[] = ['max', 'min']

/** `matrix-aggregate` reducers when the quantity is `extensive`. */
const MATRIX_REDUCERS_EXTENSIVE: readonly MatrixReducer[] = ['sum', 'mean', 'max', 'min']
/** `matrix-aggregate` reducers otherwise — averages/rates/probabilities. */
const MATRIX_REDUCERS_RESTRICTED: readonly MatrixReducer[] = ['max', 'min']

export function supportedAoiReducers(_cls: MeasurementClass): readonly AoiReducer[] {
  return AGGREGATE_AOI_REDUCERS
}

export function supportedMatrixReducers(cls: MeasurementClass): readonly MatrixReducer[] {
  return cls === 'extensive' ? MATRIX_REDUCERS_EXTENSIVE : MATRIX_REDUCERS_RESTRICTED
}

// ─── Abstract metric shape ───────────────────────────────────────────────────

/**
 * Everything the capability algebra needs to reason about a concrete metric
 * instance, derived PURELY from the recipe meta + projection (no participant
 * data). The single abstract value every predicate takes.
 */
export interface MetricShape {
  baseId: string
  /** Shape the recipe's `finalize` produces, before projection. */
  rawShape: OutputShape
  /** Shape after the projection is applied (what plots consume). */
  outputShape: OutputShape
  measurementClass: MeasurementClass
  windowed: boolean
  windowUnit: WindowUnit
  providesAnyFixation: boolean
  unit: string
}

/** Derive the abstract {@link MetricShape} from a metric's meta + a projection. */
export function metricShape(meta: MetricMeta, projection: Projection): MetricShape {
  return {
    baseId: meta.id,
    rawShape: meta.rawShape,
    outputShape: projectionOutputShape(projection),
    measurementClass: meta.measurementClass,
    windowed: projection.kind === 'windowed',
    windowUnit: meta.windowUnit,
    providesAnyFixation: meta.providesAnyFixation,
    unit: meta.unit,
  }
}
