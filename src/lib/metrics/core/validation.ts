/**
 * The single validation entry point: a recipe plus a projection gives `true`
 * or a human-readable rejection reason. Layers, in order — raw-shape
 * compatibility, the windowing wrapper, slot refs, the reducer gates below,
 * then the author's own `rejects` hook.
 *
 * Invalid combinations are hidden outright, with no warning copy.
 */
import type { MetricRecipe } from './dsl'
import {
  PROJECTION_LEAVES,
  leafOf,
  leafSummaryStatistic,
  type Projection,
} from './projection'
import { supportedMatrixReducers } from './measurement'

export type ValidationResult = true | string

/**
 * `aggregate-aoi`: extremes only (max/min are order statistics, invariant to
 * how many AOIs the analyst drew, while sum/mean/median are biased by the
 * segmentation), and the extreme must be NAMED by the recipe — an unnamed one
 * has no defined reading. `matrix-aggregate`: a pure table on
 * `measurementClass`, never string-matching on units.
 */
function checkReducer(
  recipe: MetricRecipe<any, any>,
  p: Projection,
): string | null {
  const leaf = leafOf(p)
  if (leaf.kind === 'aggregate-aoi') {
    if (leaf.reducer !== 'max' && leaf.reducer !== 'min') {
      return `Reducer "${leaf.reducer}" across AOIs is biased by the AOI segmentation; only the extremes (max/min) are offered.`
    }
    if (!recipe.aoiAggregate?.[leaf.reducer]) {
      return `Metric "${recipe.id}" names no meaning for "${leaf.reducer}" across AOIs.`
    }
  } else if (leaf.kind === 'matrix-aggregate') {
    if (!supportedMatrixReducers(recipe.measurementClass).includes(leaf.reducer)) {
      return `Reducer "${leaf.reducer}" across matrix cells is not meaningful for this metric.`
    }
  } else if (leafSummaryStatistic(leaf)) {
    // Declaration gates disclosure, as with aggregate-aoi: on a recipe with no
    // sample (a count, a total) a statistic would advertise a summarization
    // that never happens. One predicate, so a fourth SUMMARY leaf inherits it.
    if (!recipe.sampleSummary) {
      return `Metric "${recipe.id}" has no per-event sample to summarize.`
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
