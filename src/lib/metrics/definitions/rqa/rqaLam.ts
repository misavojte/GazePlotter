import { defineMetric } from '../../core/defineMetric'
import { boolParam, integerParam } from '../../core/params'
import { rqaScalar } from '../../core/rqa'

const params = [
  integerParam('v_min', 'Min line', 2, { min: 2, max: 20 }),
  boolParam('include_no_aoi', 'Include off-AOI fixations', false),
] as const

/**
 * ## Laminarity (LAM)
 *
 * Fraction of recurrent fixation pairs that form vertical lines in the
 * recurrence matrix, as a percentage. High values indicate gaze repeatedly
 * dwells on the same AOI before transitioning.
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
 * ### Usage
 * ```ts
 * query(
 *   { id: 'rqaLam', baseId: 'rqaLam', params: { v_min: 2 },
 *     projection: { kind: 'identity-scalar' }, label: 'Laminarity' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Shares the `{ seq: number[] }` accumulator shape with other RQA metrics.
 */
defineMetric({
  id: 'rqaLam',
  label: 'Laminarity',
  description: 'Laminarity (%): fraction of recurrent fixation pairs forming vertical lines in the recurrence matrix. High values indicate the gaze repeatedly dwells on the same AOI before transitioning.',
  unit: '%',
  category: 'rqa-aoi',
  rawShape: 'scalar',
  windowUnit: 'fixations',
  searchTags: ['rqa', 'laminarity', 'lam', 'vertical', 'nonlinear', 'aoi', 'sequence'],
  params,
  init: (): { seq: number[] } => ({ seq: [] }),
  onFixation: (acc, { slots }, { slots: info, params }) => {
    if (slots.length === 1) acc.seq.push(slots[0])
    else if (params.include_no_aoi && slots.length === 0) acc.seq.push(info.noAoiSlot)
  },
  finalize: (acc, _slots, ctx) =>
    [rqaScalar(acc.seq, ctx.params.v_min, r => r.LAM)],
  windowedFinalize: (acc, from, to, ctx) =>
    rqaScalar(acc.seq.slice(from, to), ctx.params.v_min, r => r.LAM),
})
