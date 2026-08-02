import { defineMetric } from '../../core/defineMetric'

/**
 * ## Eye-movement count
 *
 * Number of segments of EACH eye-movement type — one value per type present
 * in the dataset (fixations, saccades, blinks, ...), on the canonical
 * displayed-name axis. The type is a dimension, never a parameter: extract a
 * single type via the `pick-category` projection, exactly as aoi-vector
 * metrics pair with `pick-aoi`.
 *
 * - **Shape:** `category-vector`
 * - **Unit:** `count`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (midpoint membership, the SW-RQA convention)
 *
 * ### Parameters
 * None.
 *
 * ### Invariants
 * - A type the recording cannot contain (fixation-only sources record no
 *   saccades or blinks) counts 0 — "none recorded", not "none occurred".
 * - The Fixation slot must equal `fixationCount`'s any-fixation total — the
 *   equivalence pin for the category scan.
 */
defineMetric({
  id: 'movementCount',
  label: 'Eye-movement count',
  description: 'Per eye-movement type: count of segments of that type. A type the recording cannot contain (fixation-only sources) counts 0.',
  unit: 'count',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  // Extensive: a raw count — cohort `sum` and per-participant `mean` are both
  // sound across participants (mirrors fixationCount).
  measurementClass: 'extensive',
  searchTags: ['saccade', 'blink', 'fixation', 'count', 'number', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  accumulation: 'stateful',
  init: ({ categorySlotCount }) => new Float64Array(categorySlotCount),
  onFixation: (acc, { frame, categorySlot }) => {
    // SW-RQA membership: a segment contributes to the window(s) whose
    // interval contains its midpoint — exactly one per non-overlapping
    // tiling, where per-window counts sum to the unwindowed total. Always
    // true for unbounded scopes.
    if (!frame.midpointInWindow || categorySlot < 0) return
    acc[categorySlot]++
  },
  finalize: acc => Array.from(acc),
})
