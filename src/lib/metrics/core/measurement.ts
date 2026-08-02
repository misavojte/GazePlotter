/**
 * # Capability algebra over an abstract metric shape
 *
 * "Can action X be performed over metric Y?" as pure logic — every function is
 * a total function of `MeasurementClass`, with no recipe callbacks and no
 * runtime-value dependence, so the surface is fully enumerable and a future
 * statistics engine has one place to add predicates over the same abstraction.
 *
 * Three orthogonal aggregation axes, kept separate:
 *   - within-participant shape reduction → {@link supportedMatrixReducers} for
 *     matrix cells; across AOIs the gate is the metric's own `aoiAggregate`.
 *   - cross-participant reduction → {@link soundReductions}
 *   - distribution display → {@link distributionStatistics}
 */
import type { MatrixReducer } from './projection'

/**
 * The statistical class of a metric's per-participant value.
 *
 *   - `extensive`  — a physical quantity that adds: counts, summed durations.
 *     Cohort `sum` and per-participant `mean` are both sound, across
 *     participants and across matrix cells.
 *   - `intensive`  — a per-participant normalized value: an average, rate,
 *     percentage, probability, or latency. Only `mean` is sound across
 *     participants; summing shares is nonsense.
 *   - `proportion` — a per-participant 0/1 indicator ("was fixated"). The
 *     cross-participant value IS the fraction, numerically a mean; it also
 *     flags proportional rendering.
 *   - `relational` — defined per participant PAIR (scanpath similarity), so
 *     there is no per-participant value to reduce.
 */
export type MeasurementClass = 'extensive' | 'intensive' | 'proportion' | 'relational'

/**
 * Collapses per-participant results to one value per cell. Closed set: a
 * centre vs a cohort total. `median` is deliberately absent — two central
 * tendencies of one distribution are a display choice
 * ({@link DistributionStat}), not a separate reduction.
 */
export type GroupReduction = 'mean' | 'sum'

/**
 * How a distribution-oriented plot summarises the per-participant sample it
 * draws. Plot-layer only; never collapses the data to a transported number.
 */
export type DistributionStat = 'mean' | 'median' | 'ci95' | 'sd' | 'iqr'

// ─── Cross-participant reduction (axis B) ────────────────────────────────────

/** THE enumerable source the metric library and the runtime both read. */
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
 * A `proportion` is a single [0,1] rate (one proportional bar, no spread
 * overlay); `relational` has no per-participant distribution. Hence `[]`.
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

const MATRIX_REDUCERS_EXTENSIVE: readonly MatrixReducer[] = ['sum', 'mean', 'max', 'min']
/** Averages/rates/probabilities: only extremes read across cells. */
const MATRIX_REDUCERS_RESTRICTED: readonly MatrixReducer[] = ['max', 'min']

export function supportedMatrixReducers(cls: MeasurementClass): readonly MatrixReducer[] {
  return cls === 'extensive' ? MATRIX_REDUCERS_EXTENSIVE : MATRIX_REDUCERS_RESTRICTED
}
