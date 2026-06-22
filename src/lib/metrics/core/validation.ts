/**
 * Single validation entry point. Given a recipe and a projection, returns
 * either `true` or a human-readable rejection reason.
 *
 * Layers:
 *   1. Registry invariant: the projection's leaf must accept the recipe's raw shape.
 *   2. Wrapper invariant: a windowed projection requires a scalar-producing leaf
 *      AND the recipe must opt-in to windowing.
 *   3. Non-negative slot references.
 *   4. Reducer allow-lists for `aggregate-aoi` / `matrix-aggregate`. These are
 *      pure tables keyed on the recipe's `measurementClass` (via
 *      `supportedAoiReducers` / `supportedMatrixReducers` in `core/measurement`).
 *      No string-matching on units — the "is this a rate / probability" question
 *      is answered by the declared class (only `extensive` unlocks sum/mean
 *      across matrix cells).
 *   5. Author-level `rejects` hook as a final escape hatch.
 *
 * Invalid combinations are hidden outright — no warning copy — per the
 * codified "no hedging" preference.
 */
import type { MetricRecipe } from './dsl'
import {
  PROJECTION_LEAVES,
  leafOf,
  type Projection,
} from './projection'
import { supportedAoiReducers, supportedMatrixReducers } from './measurement'

export type ValidationResult = true | string

/**
 * Within-participant reducer allow-lists, derived purely from the recipe's
 * `measurementClass` via the capability tables in `core/measurement.ts`
 * (`aggregate-aoi` is always max|min; `matrix-aggregate` is the full set only
 * for `extensive` quantities). No string-matching on units — the soundness
 * question is answered by the declared class.
 */
function checkReducer(
  recipe: MetricRecipe<any, any>,
  p: Projection,
): string | null {
  const leaf = leafOf(p)
  if (leaf.kind === 'aggregate-aoi') {
    if (!supportedAoiReducers(recipe.measurementClass).includes(leaf.reducer)) {
      return `Reducer "${leaf.reducer}" across AOIs is not meaningful; pick max or min, or use a stimulus-level metric.`
    }
  } else if (leaf.kind === 'matrix-aggregate') {
    if (!supportedMatrixReducers(recipe.measurementClass).includes(leaf.reducer)) {
      return `Reducer "${leaf.reducer}" across matrix cells is not meaningful for this metric.`
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
  if (leaf.kind === 'pick-any-fixation' && !recipe.providesAnyFixation) {
    return `Metric "${recipe.id}" does not provide an "any fixation" aggregate.`
  }
  if (projection.kind === 'windowed') {
    if (def.outputShape !== 'scalar' && def.outputShape !== 'aoi-vector') {
      return 'Only scalar- or aoi-vector-producing projections can be windowed.'
    }
    if (recipe.supportsWindowing === false) {
      return `Metric "${recipe.id}" does not support windowing.`
    }
  }

  const slotReason = checkSlotRefs(projection)
  if (slotReason) return slotReason

  const reducerReason = checkReducer(recipe, projection)
  if (reducerReason) return reducerReason

  const authorReason = recipe.rejects?.(projection)
  if (authorReason) return authorReason

  return true
}
