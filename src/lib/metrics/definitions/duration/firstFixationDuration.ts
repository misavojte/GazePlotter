import { defineFirstHitMetric } from '../ttf/defineFirstHitMetric'

/**
 * ## First fixation duration
 *
 * Duration (ms) of the very first fixation on each AOI. Reflects initial
 * processing depth upon first encounter with the region.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `ttf` (first-fixation family)
 * - **Windowing:** forbidden — "first" is a stimulus-lifetime concept;
 *   a rolling window would redefine "first" per window, which is not what
 *   the scientific literature means by this metric.
 *
 * ### Parameters
 * None.
 *
 * ### Invariants
 * - AOIs never fixated return `NaN` (represented as `-1` in the accumulator,
 *   mapped to `NaN` in `finalize`).
 * - `supportsWindowing: false` — the validator rejects any windowed projection.
 */
defineFirstHitMetric({
  id: 'firstFixationDuration',
  label: 'First fixation duration',
  description: 'Per AOI: duration (ms) of the first fixation that landed inside it. Reflects initial processing depth on first encounter. No value if the AOI was never fixated.',
  searchTags: ['first', 'fixation', 'duration', 'ttf', 'aoi'],
  extractValue: (fix) => fix.duration,
})
