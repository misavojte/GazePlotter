import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

/**
 * ## Mean transition dwell time
 *
 * Average time (ms) spent at AOI `i` before transitioning to AOI `j`.
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `ms`
 * - **Category:** `transition`
 * - **Windowing:** supported (matrix-cell / matrix-aggregate inner leaf).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): fixation → duration of the single
 *   preceding fixation; visit → total duration of the preceding visit.
 *
 * ### Invariants
 * - Per-participant: cell `[i, j]` = `auxMatrix[i,j] / matrix[i,j]` (dwell
 *   sum / transition count). Cells with no observed transitions emit `NaN`.
 * - Cross-participant: mean-of-per-participant-means, so each participant
 *   contributes equally regardless of their transition count — standard
 *   eye-tracking reporting. Non-observing participants drop via NaN.
 * - Not `additive` — averaging averages across cells is not meaningful;
 *   `matrix-aggregate` restricted to `max | min`.
 */
defineTransitionMetric<Params>({
  id: 'transitionDwellMean',
  label: 'Mean transition dwell time',
  description:
    'Per AOI pair (row → column): mean pre-transition dwell time before each row → column transition. ' +
    'In fixation mode that\'s the duration of the single preceding fixation; in visit mode, the duration ' +
    'of the preceding visit.',
  unit: 'ms',
  groupAggregation: 'mean',
  defaultLabel: p =>
    p.mode === 'visit'
      ? 'Mean transition dwell time (visit changes)'
      : 'Mean transition dwell time (fixation pairs)',
  searchTags: ['transition', 'dwell', 'mean', 'average', 'duration', 'pair', 'aoi', 'time'],
  withAux: true,
  onTransition: (acc, cellIdx, prevDuration) => {
    acc.matrix[cellIdx]++                     // count
    acc.auxMatrix![cellIdx] += prevDuration   // dwell sum
  },
  finalize: acc => {
    const out = new Array<number>(acc.matrix.length)
    for (let i = 0; i < acc.matrix.length; i++) {
      out[i] = acc.matrix[i] > 0 ? acc.auxMatrix![i] / acc.matrix[i] : Number.NaN
    }
    return out
  },
})
