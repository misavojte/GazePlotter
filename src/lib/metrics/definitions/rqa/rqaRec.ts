import { defineRqaMetric } from './defineRqaMetric'

/**
 * ## Recurrence rate (REC)
 *
 * Fraction of fixation sequence pairs that land on the same AOI, as a
 * percentage. Quantifies how repetitive the participant's gaze pattern is
 * across the stimulus — a standard RQA measure.
 *
 * - **Shape:** `scalar`
 * - **Unit:** `%`
 * - **Category:** `rqa-aoi`
 * - **Windowing:** supported — fixation-windowed (`windowUnit: 'fixations'`).
 *   Produces a scalar timeseries; the inner projection must be
 *   `identity-scalar`.
 *
 * ### Parameters
 * - `include_no_aoi` (boolean, default `false`): when true, off-AOI
 *   fixations (tagged by zero AOIs) participate in the sequence as the
 *   sentinel `noAoiSlot` category; otherwise they're skipped entirely.
 *
 * ### Invariants
 * - Accumulates into `{ seq: number[] }` — the shared fixation-windowed
 *   contract enforced by `core/runtime.ts`.
 * - A fixation tagged by multiple raw AOIs mapping to a single slot is
 *   added once (dedup); `slots.length === 1` gate filters to
 *   single-AOI fixations only (unless `include_no_aoi` expands it).
 */
defineRqaMetric({
  id: 'rqaRec',
  label: 'Recurrence rate',
  description: "Stimulus-level: recurrence rate (%) — fraction of fixation-sequence pairs that revisit the same AOI. Higher values indicate a more repetitive gaze pattern across the stimulus.",
  searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
  measure: r => r.REC,
  onNoRecurrence: 0,
})
