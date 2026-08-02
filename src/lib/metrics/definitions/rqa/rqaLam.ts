import { defineRqaMetric } from './defineRqaMetric'

/**
 * ## Laminarity (LAM)
 *
 * Fraction of recurrent fixation pairs that form vertical OR horizontal lines
 * in the recurrence matrix, as a percentage (`(HL + VL) / 2R`, the standard
 * eye-tracking LAM for a symmetric recurrence plot). High values indicate gaze
 * repeatedly dwells on the same AOI before transitioning.
 *
 * - **Shape:** `scalar`
 * - **Unit:** `%`
 * - **Category:** `rqa-aoi`
 * - **Windowing:** supported — fixation-windowed.
 *
 * ### Parameters
 * - `v_min` (integer, default `2`, range 2–20): minimum vertical line
 *   length counted as "laminar".
 * - `include_no_aoi` (boolean, default `false`): include off-AOI fixations.
 *
 * ### Invariants
 * - Shares the `{ seq: number[] }` accumulator shape with other RQA metrics.
 */
defineRqaMetric({
  id: 'rqaLam',
  label: 'Laminarity',
  description: 'Stimulus-level: laminarity (%) — fraction of recurrent fixation pairs forming vertical or horizontal lines in the recurrence matrix. Higher values indicate the gaze repeatedly dwells on the same AOI before transitioning.',
  searchTags: ['rqa', 'laminarity', 'lam', 'vertical', 'nonlinear', 'aoi', 'sequence'],
  measure: r => r.LAM,
  minLineParam: 'v_min',
})
