/**
 * # Numeric collapse helpers
 *
 * The arithmetic every recipe and projection composes from: collapse a multiset
 * to one value, or normalise a row to shares. Pure functions over numbers, with
 * no knowledge of recipes, projections, slots or plots.
 *
 * A LEAF module by design. These used to live in `projection.ts`, whose own
 * docs admitted the placement was a workaround: `measurement.ts` imports from
 * `projection.ts`, so the natural home (`aggregation.ts`, which imports
 * `measurement.ts`) would have closed a cycle. Depending on nothing breaks that
 * cycle instead of routing around it, and stops the projection REGISTRY from
 * being the file people search for arithmetic.
 *
 * Import direction is one-way: everything may import this; this imports only a
 * type from `params.ts`, which itself imports nothing.
 */
import type { SummaryStatistic } from './params'

/**
 * Every operator {@link reduceNumeric} implements: the summary statistics plus
 * `sum`. Defined FROM {@link SummaryStatistic} so the subset relation is a type
 * fact rather than a comment — `sum` is the one operator a summary never
 * offers, because a total is its own metric (absoluteTime, movementTime).
 */
export type AoiReducer = SummaryStatistic | 'sum'

/**
 * Collapse a numeric multiset by a summary operator (finite-filtered; `NaN` when
 * empty). Shared: the `aggregate-aoi` projection leaf reduces one participant's
 * per-AOI vector, and every `sampleSummary` recipe reduces one slot's per-event
 * sample in the `finalize` that `defineMetric` derives for it.
 *
 * `reduceFinite` (aggregation.ts) is the deliberate allocation-free
 * specialisation of this for the cross-participant axis, whose operator set is
 * only {mean, sum}: it folds in a single pass instead of materialising the
 * filtered array. Same semantics on the two operators they share — that
 * duplication is a size/speed trade, not an oversight.
 */
export function reduceNumeric(values: readonly number[], method: AoiReducer): number {
  const valid = values.filter(Number.isFinite)
  if (valid.length === 0) return Number.NaN
  switch (method) {
    case 'sum': return valid.reduce((a, b) => a + b, 0)
    case 'mean': return valid.reduce((a, b) => a + b, 0) / valid.length
    // Fold rather than spread: the sample path routes a whole slot's
    // per-fixation/per-visit sample through here, which can be far larger than
    // a per-AOI vector — `Math.max(...huge)` would overflow the call stack
    // (RangeError). `valid` is non-empty (guarded above).
    case 'max': return valid.reduce((a, b) => (b > a ? b : a))
    case 'min': return valid.reduce((a, b) => (b < a ? b : a))
    case 'median': {
      const s = [...valid].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
    }
  }
}

/**
 * Each value as a PERCENTAGE of `total` — the share invariant every
 * share-of-a-total recipe finalizes with (`relativeTime` over the anyFixation
 * total, `movementTimeShare` over the scope duration,
 * `transitionRelativeFrequency` over all transitions).
 *
 * `total <= 0` yields NaN, never 0: with no gaze to normalise against, 0/0 is
 * UNDEFINED, and a real 0 would silently deflate every group and window mean
 * that averages over it. A `0` numerator with a positive total is a genuine
 * 0 % (attention went elsewhere) and stays 0.
 *
 * KEEP IN SYNC with the fused windowed driver's `clippedDurationShare`
 * normalisation (runtime.ts), which inlines this expression over a reused
 * scratch row to stay allocation-free; the windowed==oracle equivalence suite
 * pins the two against each other.
 */
export function percentShare(values: ArrayLike<number>, total: number): number[] {
  const out = new Array<number>(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = total > 0 ? (values[i] / total) * 100 : Number.NaN
  }
  return out
}
