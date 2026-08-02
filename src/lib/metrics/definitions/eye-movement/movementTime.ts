import { defineMetric } from '../../core/defineMetric'

/**
 * ## Eye-movement time
 *
 * Total time (ms) spent in segments of EACH eye-movement type — one value per
 * type on the canonical displayed-name axis; the per-type sibling of
 * `absoluteTime`. Extract a single type via the `pick-category` projection.
 *
 * - **Shape:** `category-vector`
 * - **Unit:** `ms`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (in-window overlap, so a segment crossing window
 *   boundaries contributes only its in-window portion and per-window sums
 *   equal the unwindowed total — mirrors `absoluteTime`)
 *
 * ### Parameters
 * None.
 *
 * ### Invariants
 * - 0 for types the recording contains no segments of (same caveat as
 *   `movementCount`: fixation-only sources cannot record them).
 */
defineMetric({
  id: 'movementTime',
  label: 'Eye-movement time',
  description: 'Per eye-movement type: total time (ms) spent in segments of that type. 0 for types the recording contains no segments of.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  // Extensive: a physical duration that adds — cohort `sum` and
  // per-participant `mean` are both sound (mirrors absoluteTime).
  measurementClass: 'extensive',
  searchTags: ['saccade', 'blink', 'time', 'total', 'duration', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  accumulation: 'stateful',
  init: ({ categorySlotCount }) => new Float64Array(categorySlotCount),
  onFixation: (acc, { frame, categorySlot }) => {
    // Read `frame.duration` (in-window overlap) so windowed sums compose;
    // across an unbounded scope it equals the segment's own duration.
    if (categorySlot < 0) return
    acc[categorySlot] += frame.duration
  },
  finalize: acc => Array.from(acc),
})
