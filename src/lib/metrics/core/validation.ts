/**
 * Central validation for metric instances — the "cooking system" guardrail.
 * Runs a list of pure rules plus any per-recipe `rejectedProjections` hook.
 * First non-null `reason` wins and the instance is considered invalid.
 *
 * Consumers (context filter, library modal pickers, MCP describe) call this
 * to decide what to surface. Invalid combinations are hidden outright — no
 * warning copy — per the codified "no hedging" preference.
 *
 * This does NOT cover scientific safeguards (sample size, zero variance,
 * min fixations); those belong in a separate pass.
 */
import type { MetricRecipe, WindowingConfig } from './dsl'
import type { Projection } from './projection'

export interface ValidationInput {
  recipe: MetricRecipe<any, any>
  projection: Projection
  windowing?: WindowingConfig
}

export type ValidationResult = { ok: true } | { ok: false; reason: string }

type Rule = (input: ValidationInput) => string | null

// ─── Built-in rules ─────────────────────────────────────────────────────────

const isPercentLike = (unit: string): boolean =>
  unit === '%' || unit === 'percent' || unit === 'probability'

/** sum of percentages / probabilities is not a meaningful quantity. */
const ruleUnitAggregateSum: Rule = ({ recipe, projection }) => {
  if (!isPercentLike(recipe.unit)) return null
  if (projection.target === 'scalar'
      && projection.from === 'aggregate-aoi'
      && projection.reducer === 'sum') {
    return 'Summing percentages/probabilities across AOIs is not meaningful.'
  }
  if (projection.target === 'scalar'
      && projection.from === 'matrix-aggregate'
      && projection.reducer === 'sum') {
    return 'Summing percentages/probabilities across the matrix is not meaningful.'
  }
  return null
}

/**
 * Row-normalised probability matrices degenerate under matrix-wide mean:
 * each row sums to 100%, so matrix-wide mean ≡ 100 / side², i.e. a
 * deterministic function of AOI count, not of participant behaviour.
 * Relative-frequency matrices have the same issue at the whole-matrix level.
 */
const ruleMatrixAggregateMeanOnPercentMatrix: Rule = ({ recipe, projection }) => {
  if (recipe.outputShape !== 'aoi-pair-matrix') return null
  if (!isPercentLike(recipe.unit)) return null
  if (projection.target === 'scalar'
      && projection.from === 'matrix-aggregate'
      && projection.reducer === 'mean') {
    return 'Matrix-wide mean of a probability / relative-frequency matrix is deterministic (≡ 1 / side²); use matrix-cell instead.'
  }
  return null
}

/**
 * Projection binds to an outside-AOI slot — the No-AOI / anyFixation channel
 * isn't a meaningful target for a pick/row/col/cell projection. By-name refs
 * can't hit it (outside isn't in the displayed-name union), so this only
 * catches explicit by-slot refs coming from programmatic / MCP callers.
 *
 * Note: we don't know `side` at validate time (no scope yet), so we can only
 * reject obviously-out-of-range slot indices (< 0). Positive-index over-reach
 * is handled at apply time (NaN + aoiMissing).
 */
const ruleOutsideAoiSlotRef: Rule = ({ projection }) => {
  const slotRefs =
    projection.target === 'scalar' && projection.from === 'pick-aoi' ? [projection.aoiRef] :
    projection.target === 'aoi-vector' && (projection.from === 'matrix-row' || projection.from === 'matrix-col') ? [projection.aoiRef] :
    projection.target === 'scalar' && projection.from === 'matrix-cell' ? [projection.fromAoi, projection.toAoi] :
    []
  for (const ref of slotRefs) {
    if (ref.by === 'slot' && ref.slot < 0) {
      return 'AOI slot reference must be non-negative.'
    }
  }
  return null
}

/** Windowing mode must be one the recipe advertises as supported. */
const ruleWindowingModeSupported: Rule = ({ recipe, windowing }) => {
  if (!windowing) return null
  const supported = recipe.computationModes ?? ['global']
  if (!supported.includes(windowing.mode)) {
    return `Recipe "${recipe.id}" does not support computation mode "${windowing.mode}".`
  }
  return null
}

const BUILTIN_RULES: readonly Rule[] = [
  ruleUnitAggregateSum,
  ruleMatrixAggregateMeanOnPercentMatrix,
  ruleOutsideAoiSlotRef,
  ruleWindowingModeSupported,
]

// ─── Public API ─────────────────────────────────────────────────────────────

export function validateCombination(input: ValidationInput): ValidationResult {
  for (const rule of BUILTIN_RULES) {
    const reason = rule(input)
    if (reason) return { ok: false, reason }
  }
  const perRecipe = input.recipe.rejectedProjections?.(input.projection, input.windowing)
  if (perRecipe) return { ok: false, reason: perRecipe }
  return { ok: true }
}

/**
 * @deprecated Use `validateCombination` — this narrow helper only covers the
 * %-unit sum rule. Kept as a re-export shim for the transitional window.
 */
export function validateProjectionForUnit(
  projection: Projection,
  unit: string
): true | string {
  if (!isPercentLike(unit)) return true
  if (projection.target === 'scalar' && projection.from === 'aggregate-aoi' && projection.reducer === 'sum') {
    return 'Summing percentages is not meaningful.'
  }
  if (projection.target === 'scalar' && projection.from === 'matrix-aggregate' && projection.reducer === 'sum') {
    return 'Summing percentages is not meaningful.'
  }
  return true
}
