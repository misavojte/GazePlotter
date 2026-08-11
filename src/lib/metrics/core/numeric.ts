/**
 * # Numeric collapse helpers
 *
 * The arithmetic recipes and projections compose from. A LEAF module by
 * design — it knows nothing of recipes, projections, slots or plots, and
 * imports only a type from `params.ts`. Anything may import it; that one-way
 * direction is what keeps `measurement` → `projection` → `aggregation` acyclic.
 */
import type { SummaryStatistic } from './params'

/**
 * Defined FROM {@link SummaryStatistic} so the subset relation is a type fact.
 * `sum` is the one operator a summary never offers: a total is its own metric
 * (absoluteTime, movementTime).
 */
export type AoiReducer = SummaryStatistic | 'sum'

/**
 * Collapse a multiset by a summary operator (finite-filtered; `NaN` when
 * empty). Shared by the `aggregate-aoi` leaf and by every `sampleSummary`
 * recipe's derived `finalize`.
 *
 * `reduceFinite` (aggregation.ts) is the allocation-free cross-participant
 * specialisation over the {mean, sum} subset — same semantics where they
 * overlap; the duplication is a size/speed trade, not an oversight.
 */
export function reduceNumeric(values: readonly number[], method: AoiReducer): number {
  const valid = values.filter(Number.isFinite)
  if (valid.length === 0) return Number.NaN
  switch (method) {
    case 'sum': return valid.reduce((a, b) => a + b, 0)
    case 'mean': return valid.reduce((a, b) => a + b, 0) / valid.length
    // Fold, not spread: a whole slot's per-fixation sample routes through here
    // and `Math.max(...huge)` would overflow the call stack.
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
 * Each value as a PERCENTAGE of `total` — the shared finalize of every
 * share-of-a-total recipe.
 *
 * `total <= 0` yields NaN, never 0: 0/0 is undefined, and a real 0 would
 * silently deflate every group and window mean averaging over it. A 0
 * numerator against a positive total is a genuine 0% and stays.
 *
 * KEEP IN SYNC with the fused driver's `clippedDurationShare` normalisation
 * (runtime.ts), which inlines this over a reused scratch row to stay
 * allocation-free; pinned by the windowed==oracle suite.
 */
export function percentShare(values: ArrayLike<number>, total: number): number[] {
  const out = new Array<number>(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = total > 0 ? (values[i] / total) * 100 : Number.NaN
  }
  return out
}
