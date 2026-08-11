/**
 * # Cross-participant aggregation runtime
 *
 * How the cross-participant reduction is computed and disclosed, built on the
 * pure predicates in {@link ./measurement} (which stay "what is allowed").
 *
 * The resolution rule is trivial and shape-independent by design, so
 * request === result: a sound requested reduction is honoured verbatim, and
 * only an unsound or stale one falls back. No silent downgrade, no guard.
 */
import type { MetricMeta } from './dsl'
import { soundReductions, type GroupReduction } from './measurement'

/**
 * Shared by the label and the runtime, so what is disclosed always equals what
 * is computed. `relational` metrics have no sound reduction and never reach a
 * per-slot reduce, so the inert `'mean'` comes back.
 */
export function effectiveReduction(
  meta: MetricMeta,
  requested: GroupReduction | undefined,
): GroupReduction {
  const sound = soundReductions(meta.measurementClass)
  if (sound.length === 0) return 'mean'
  const fallback = sound.includes(meta.defaultReduction) ? meta.defaultReduction : sound[0]
  return requested && sound.includes(requested) ? requested : fallback
}

/**
 * Reduce finite values across one dimension (participants, or window·slot
 * cells). Non-finite entries skip; an all-non-finite input yields `NaN`, so
 * absent participants drop rather than bias toward zero.
 *
 * The cross-participant sibling of `reduceNumeric` (core/numeric.ts). It folds
 * in one pass instead of materialising a filtered array, because it runs per
 * (slot × participant) cell — deliberate duplication, not drift.
 */
export function reduceFinite(
  values: readonly number[],
  reduction: GroupReduction,
): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (Number.isFinite(v)) {
      sum += v
      n++
    }
  }
  if (n === 0) return Number.NaN
  return reduction === 'sum' ? sum : sum / n
}

/** `mean` is the conventional default and needs no disclosure (`null`); only a
 *  cohort sum is surfaced, so a summed series reads `· summed`. */
export function reductionLabel(reduction: GroupReduction): string | null {
  return reduction === 'sum' ? 'summed' : null
}
