import { defineMetric } from '../../core/defineMetric'
import { boolParam, integerParam } from '../../core/params'
import { rqaScalar } from '../../core/rqa'

const params = [
  integerParam('l_min', 'Min line', 2, { min: 2, max: 20 }),
  boolParam('include_no_aoi', 'Include off-AOI fixations', false),
] as const

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
defineMetric({
  id: 'rqaDet',
  label: 'Determinism',
  description: 'Stimulus-level: determinism (%) — fraction of recurrent fixation pairs forming diagonal lines in the recurrence matrix. Higher values indicate predictable, repeated scan paths.',
  unit: '%',
  category: 'rqa-aoi',
  rawShape: 'scalar',
  windowUnit: 'fixations',
  // Intensive: a per-participant rate (%). Only `mean` is sound across participants.
  measurementClass: 'intensive',
  searchTags: ['rqa', 'determinism', 'det', 'diagonal', 'nonlinear', 'aoi', 'sequence'],
  params,
  init: (): { seq: number[] } => ({ seq: [] }),
  onFixation: (acc, { slots }, { slots: info, params }) => {
    if (slots.length === 1) acc.seq.push(slots[0])
    else if (params.include_no_aoi && slots.length === 0) acc.seq.push(info.noAoiSlot)
  },
  finalize: (acc, _slots, ctx) =>
    [rqaScalar(acc.seq, ctx.params.l_min, r => r.DET)],
  windowedFinalize: (acc, from, to, ctx) =>
    rqaScalar(acc.seq.slice(from, to), ctx.params.l_min, r => r.DET),
})
