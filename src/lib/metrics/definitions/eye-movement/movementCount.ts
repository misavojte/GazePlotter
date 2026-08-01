import { defineMetric } from '../../core/defineMetric'
import { eyeMovementTypeParam } from './eyeMovementTypeParam'

/**
 * ## Eye-movement count
 *
 * Number of segments of the chosen eye-movement type (saccades by default;
 * any type the dataset records, by displayed name — including Fixation, where
 * it equals `fixationCount`'s any-fixation total).
 *
 * - **Shape:** `scalar`
 * - **Unit:** `count`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (midpoint membership, the SW-RQA convention)
 *
 * ### Parameters
 * - `eyeMovementType` — which segment category to count, by displayed name.
 *
 * ### Invariants
 * - 0 when the recording contains no such segments. Fixation-only sources
 *   (plain CSV, Ogama, Varjo, Pupil Cloud) structurally cannot record
 *   saccades or blinks — a 0 there means "none recorded", not "none occurred".
 * - At `eyeMovementType: 'Fixation'` this must equal `fixationCount`'s
 *   any-fixation value — the equivalence pin for the category scan.
 */
defineMetric({
  id: 'movementCount',
  label: 'Eye-movement count',
  description: 'Stimulus-level: count of segments of the chosen eye-movement type (by displayed name; saccades by default). 0 when the recording contains no such segments — fixation-only sources cannot record them.',
  unit: 'count',
  category: 'eye-movement',
  rawShape: 'scalar',
  windowUnit: 'ms',
  // Extensive: a raw count — cohort `sum` and per-participant `mean` are both
  // sound across participants (mirrors fixationCount).
  measurementClass: 'extensive',
  searchTags: ['saccade', 'blink', 'count', 'number', 'eye movement', 'type', 'event'],
  params: [eyeMovementTypeParam] as const,
  scanSource: 'categoryParam',
  accumulation: 'stateful',
  init: () => ({ n: 0 }),
  onFixation: (acc, { frame }) => {
    // SW-RQA membership: a segment contributes to the window(s) whose
    // interval contains its midpoint — exactly one per non-overlapping
    // tiling, where per-window counts sum to the unwindowed total. Always
    // true for unbounded scopes.
    if (!frame.midpointInWindow) return
    acc.n++
  },
  finalize: acc => [acc.n],
})
