/**
 * # Cross-participant aggregation runtime
 *
 * The runtime maths + resolution for the cross-participant reduction axis,
 * built on the pure capability algebra in {@link ./measurement}. Kept separate
 * from `measurement.ts` (which is pure predicates / "what is allowed") so this
 * file owns only the "how it is computed and disclosed" side.
 *
 * The resolution rule is deliberately trivial and shape-independent so that an
 * MCP/LLM gets **request === result**: a sound requested reduction is honoured
 * verbatim; only an unsound or stale value falls back to the metric's natural
 * default. No silent median→mean, no projection-shape downgrade, no guard.
 */
import type { MetricMeta } from './dsl'
import { soundReductions, type GroupReduction } from './measurement'

/**
 * The effective cross-participant reduction for a (metric, requested) pair —
 * the single source of truth shared by the label and the runtime, so what is
 * disclosed always equals what is computed. Pure: `requested` wins when it is in
 * the sound set; otherwise the metric's `defaultReduction` (clamped into the
 * sound set) is used. `relational` metrics have no sound reduction and never
 * reach a per-slot reduce, so the inert `'mean'` is returned.
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
 * Reduce finite values across one dimension (participants, or window·slot cells)
 * by `mean` or `sum`. Non-finite entries are skipped; an all-non-finite input
 * yields `NaN` (so absent participants drop rather than bias toward zero). The
 * atomic reduction the per-slot and windowed group paths compose against.
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

/**
 * The disclosure word for a reduction, as a mid-dot readout qualifier. `mean`
 * is the conventional default and needs no disclosure (returns `null`); only a
 * cohort `sum` is surfaced so a summed series reads `· summed`.
 */
export function reductionLabel(reduction: GroupReduction): string | null {
  return reduction === 'sum' ? 'summed' : null
}
