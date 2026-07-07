import { defineRqaMetric } from './defineRqaMetric'

/**
 * ## Determinism (DET)
 *
 * Fraction of recurrent fixation pairs that form diagonal lines in the
 * recurrence matrix, as a percentage. High values indicate predictable,
 * repeated scanning paths.
 *
 * - **Shape:** `scalar`
 * - **Unit:** `%`
 * - **Category:** `rqa-aoi`
 * - **Windowing:** supported — fixation-windowed.
 *
 * ### Parameters
 * - `l_min` (integer, default `2`, range 2–20): minimum diagonal line
 *   length counted as "deterministic".
 * - `include_no_aoi` (boolean, default `false`): include off-AOI fixations
 *   in the sequence via the `noAoiSlot` sentinel.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'rqaDet', baseId: 'rqaDet', params: { l_min: 2 },
 *     projection: { kind: 'identity-scalar' }, label: 'Determinism' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Shares the `{ seq: number[] }` accumulator shape with other RQA
 *   metrics; `windowedFinalize` rescans a sliced sub-sequence per window.
 */
defineRqaMetric({
  id: 'rqaDet',
  label: 'Determinism',
  description: 'Stimulus-level: determinism (%) — fraction of recurrent fixation pairs forming diagonal lines in the recurrence matrix. Higher values indicate predictable, repeated scan paths.',
  searchTags: ['rqa', 'determinism', 'det', 'diagonal', 'nonlinear', 'aoi', 'sequence'],
  measure: r => r.DET,
  minLineParam: 'l_min',
})
