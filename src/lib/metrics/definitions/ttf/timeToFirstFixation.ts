import { defineFirstHitMetric } from './defineFirstHitMetric'

/**
 * ## Time to first fixation
 *
 * Elapsed time (ms) from stimulus onset until the first fixation on each AOI.
 * Lower values mean the region captured attention earlier.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `ttf`
 * - **Windowing:** forbidden — "first" is a stimulus-lifetime concept; a
 *   rolling window would redefine "first" per window.
 *
 * ### Parameters
 * None.
 *
 * ### Invariants
 * - AOIs never fixated return `NaN` (represented as `-1` in the accumulator,
 *   mapped to `NaN` in `finalize`). Callers that prefer a sentinel numeric
 *   value convert downstream (e.g. CSV export uses `-1`).
 * - `supportsWindowing: false` — the validator rejects any windowed projection.
 */
defineFirstHitMetric({
  id: 'timeToFirstFixation',
  label: 'Time to first fixation',
  description: 'Per AOI: elapsed time (ms) from stimulus onset to the first fixation that landed in the AOI. Lower values mean the AOI captured attention earlier. No value if the AOI was never fixated.',
  searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
  aoiAggregate: { min: 'first-reached AOI', max: 'last-reached AOI' },
  extractValue: (fix) => fix.start,
})
