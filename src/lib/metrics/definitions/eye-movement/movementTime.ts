import { defineMetric } from '../../core/defineMetric'
import { eyeMovementTypeParam } from '../../core/categoryScan'

interface Acc {
  total: number
}

/**
 * ## Eye-movement time
 *
 * Total time (ms) spent in segments of the chosen eye-movement type — the
 * scalar sibling of `absoluteTime` for saccades, blinks, and any other
 * recorded type.
 *
 * - **Shape:** `scalar`
 * - **Unit:** `ms`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (in-window overlap, so a segment crossing window
 *   boundaries contributes only its in-window portion and per-window sums
 *   equal the unwindowed total — mirrors `absoluteTime`)
 *
 * ### Parameters
 * - `eyeMovementType` — which segment category to total, by displayed name.
 *
 * ### Invariants
 * - 0 when the recording contains no such segments (same caveat as
 *   `movementCount`: fixation-only sources cannot record them).
 */
defineMetric({
  id: 'movementTime',
  label: 'Eye-movement time',
  description: 'Stimulus-level: total time (ms) spent in segments of the chosen eye-movement type (by displayed name; saccades by default). 0 when the recording contains no such segments — fixation-only sources cannot record them.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'scalar',
  windowUnit: 'ms',
  // Extensive: a physical duration that adds — cohort `sum` and
  // per-participant `mean` are both sound (mirrors absoluteTime).
  measurementClass: 'extensive',
  searchTags: ['saccade', 'blink', 'time', 'total', 'duration', 'eye movement', 'type'],
  params: [eyeMovementTypeParam] as const,
  scanSource: 'categoryParam',
  accumulation: 'stateful',
  init: (): Acc => ({ total: 0 }),
  onFixation: (acc, { frame }) => {
    // Read `frame.duration` (in-window overlap) so windowed sums compose;
    // across an unbounded scope it equals the segment's own duration.
    acc.total += frame.duration
  },
  finalize: acc => [acc.total],
})
