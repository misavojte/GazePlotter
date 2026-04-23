import { defineMetric } from '../../core/defineMetric'
import { boolParam } from '../../core/params'
import { rqaScalar } from '../../core/rqa'

const params = [
  boolParam('include_no_aoi', 'Include off-AOI fixations', false),
] as const

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
 * ### Usage
 * ```ts
 * query(
 *   { id: 'rqaRec', baseId: 'rqaRec', params: {},
 *     projection: { kind: 'identity-scalar' }, label: 'Recurrence rate' },
 *   { engine, stimulusId, participantId },
 * )
 * // or windowed (timeseries of REC over the scan):
 * { kind: 'windowed',
 *   window: { windowSize: 50, stepSize: 1 },
 *   inner: { kind: 'identity-scalar' } }
 * ```
 *
 * ### Invariants
 * - Accumulates into `{ seq: number[] }` — the shared fixation-windowed
 *   contract enforced by `core/runtime.ts`.
 * - A fixation tagged by multiple raw AOIs mapping to a single slot is
 *   added once (dedup); `slots.length === 1` gate filters to
 *   single-AOI fixations only (unless `include_no_aoi` expands it).
 */
defineMetric({
  id: 'rqaRec',
  label: 'Recurrence rate',
  description: "Recurrence rate (%): fraction of fixation sequence pairs that revisit the same AOI. Quantifies how repetitive the participant's gaze pattern is across the stimulus.",
  unit: '%',
  category: 'rqa-aoi',
  rawShape: 'scalar',
  windowUnit: 'fixations',
  searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
  params,
  init: (): { seq: number[] } => ({ seq: [] }),
  onFixation: (acc, { slots }, { slots: info, params }) => {
    if (slots.length === 1) acc.seq.push(slots[0])
    else if (params.include_no_aoi && slots.length === 0) acc.seq.push(info.noAoiSlot)
  },
  finalize: (acc) => [rqaScalar(acc.seq, 2, r => r.REC, 0)],
  windowedFinalize: (acc, from, to) =>
    rqaScalar(acc.seq.slice(from, to), 2, r => r.REC, 0),
})
