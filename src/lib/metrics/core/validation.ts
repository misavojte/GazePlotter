/**
 * Single validation entry point. Given a recipe and a projection, returns
 * either `true` or a human-readable rejection reason.
 *
 * Combines three layers:
 *   1. Registry invariant: the projection's leaf must accept the recipe's raw shape.
 *   2. Wrapper invariant: a windowed projection requires a scalar-producing leaf
 *      AND the recipe must opt-in to windowing.
 *   3. Cross-cutting scientific guards (percent-unit aggregates that don't make sense).
 *   4. Author-level `rejects` hook on the recipe for domain-specific vetoes.
 *
 * Invalid combinations are hidden outright — no warning copy — per the
 * codified "no hedging" preference.
 */
import type { MetricRecipe } from './dsl'
import { PROJECTION_LEAVES, leafOf, type Projection } from './projection'

export type ValidationResult = true | string

const isPercentLike = (unit: string): boolean =>
  unit === '%' || unit === 'percent' || unit === 'probability'

/** Cross-cutting guard: sum / mean of percentages is not meaningful. */
function checkScientificGuards(
  recipe: MetricRecipe<any, any>,
  p: Projection,
): string | null {
  if (!isPercentLike(recipe.unit)) return null
  const leaf = leafOf(p)
  if (leaf.kind === 'aggregate-aoi' && leaf.reducer === 'sum') {
    return 'Summing percentages/probabilities across AOIs is not meaningful.'
  }
  if (leaf.kind === 'matrix-aggregate') {
    if (leaf.reducer === 'sum') {
      return 'Summing percentages/probabilities across the matrix is not meaningful.'
    }
    if (leaf.reducer === 'mean' && recipe.rawShape === 'aoi-pair-matrix') {
      return 'Matrix-wide mean of a probability / relative-frequency matrix is deterministic (≡ 1 / side²); use matrix-cell instead.'
    }
  }
  return null
}

/** Negative slot-index refs are never valid (bounds handled at apply time). */
function checkSlotRefs(p: Projection): string | null {
  const leaf = leafOf(p)
  const refs =
    leaf.kind === 'pick-aoi'    ? [leaf.aoiRef] :
    leaf.kind === 'matrix-row'  ? [leaf.aoiRef] :
    leaf.kind === 'matrix-col'  ? [leaf.aoiRef] :
    leaf.kind === 'matrix-cell' ? [leaf.fromAoi, leaf.toAoi] :
    []
  for (const ref of refs) {
    if (ref.by === 'slot' && ref.slot < 0) {
      return 'AOI slot reference must be non-negative.'
    }
  }
  return null
}

export function recipeSupports(
  recipe: MetricRecipe<any, any>,
  projection: Projection,
): ValidationResult {
  const leaf = leafOf(projection)
  const def = PROJECTION_LEAVES[leaf.kind]

  if (!def.rawShapes.includes(recipe.rawShape)) {
    return `Projection "${leaf.kind}" incompatible with raw shape "${recipe.rawShape}".`
  }
  if (projection.kind === 'windowed') {
    if (def.outputShape !== 'scalar') {
      return 'Only scalar-producing projections can be windowed.'
    }
    if (recipe.supportsWindowing === false) {
      return `Metric "${recipe.id}" does not support windowing.`
    }
  }

  const slotReason = checkSlotRefs(projection)
  if (slotReason) return slotReason

  const guardReason = checkScientificGuards(recipe, projection)
  if (guardReason) return guardReason

  const authorReason = recipe.rejects?.(projection)
  if (authorReason) return authorReason

  return true
}
