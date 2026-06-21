import { defineTransitionMetric } from '../../core/defineTransitionMetric'
import { integerParam } from '../../core/params'
import { matrixPower } from '../../core/transitionScan'

interface Params { mode: 'fixation' | 'visit'; step: number }

/**
 * ## Transition probability
 *
 * Row-normalised transition probability matrix — the classical eye-tracking
 * Markov view. Cell `[i, j]` = probability that the next transition from
 * AOI `i` lands on AOI `j`.
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `%`
 * - **Category:** `transition`
 * - **Windowing:** supported (matrix-cell / matrix-aggregate inner leaf).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): `'fixation'` or `'visit'` counting.
 * - `step` (integer, default `1`, range 1–10): k-step matrix power.
 *   `step = 1` is the direct one-step probability; `step = k > 1` returns
 *   `P^k`, the probability of being at AOI `j` after `k` transitions.
 *
 * ### Invariants
 * - A "from" AOI with no out-transitions (the recording ended there, so its
 *   distribution is undefined) has an all-`NaN` row, which drops from
 *   cross-participant reduction rather than deflating group rows. A participant
 *   with zero transitions at all is all-`NaN`.
 * - `step = 1` rows sum to 100% per participant. `step = k > 1` rows may sum
 *   to LESS than 100%: the missing mass is the probability the gaze sequence
 *   ENDED (the recording finished) before completing `k` transitions from `i`.
 *   The visible cells are still exact — `P^k[i][j]` is the probability of
 *   being at `j` after `k` transitions among trajectories that survived.
 * - Not `additive` — row-stochastic matrices are not summable across cells.
 *   `matrix-aggregate` is restricted to `max | min` by the validator.
 * - Group aggregation is `mean`, taken per row only over participants that
 *   have an out-transition there (NaN rows excluded), so group rows stay
 *   row-stochastic at `step = 1`.
 */
defineTransitionMetric<Params>({
  id: 'transitionProbability',
  label: 'Transition probability',
  description:
    'Per AOI pair (from → to): row-normalised transition probability — the probability that the ' +
    'next transition out of source AOI lands on target AOI (Markov-chain view). With step ≥ 2, returns ' +
    'P^k (the probability of being at target AOI after k transitions); k-step rows may sum to under ' +
    '100%, where the remainder is the probability the gaze sequence ended before completing k transitions.',
  unit: '%',
  groupAggregation: 'mean',
  defaultLabel: p => {
    const pair = p.mode === 'visit' ? 'Visit-to-visit' : 'Fixation-to-fixation'
    const stepPhrase = p.step > 1 ? `${p.step}-step transition probability` : 'transition probability'
    return `${pair} ${stepPhrase}`
  },
  searchTags: ['transition', 'probability', 'markov', 'chain', 'aoi', 'pair', 'k-step'],
  extraParams: [integerParam('step', 'Step', 1, { min: 1, max: 10 })],
  onTransition: (acc, cellIdx) => { acc.matrix[cellIdx]++ },
  finalize: (acc, params) => {
    const n = acc.size
    let anyTransition = false
    const P = new Float64Array(n * n)
    const rowHasOut = new Array<boolean>(n)
    for (let i = 0; i < n; i++) {
      const row = i * n
      let sum = 0
      for (let j = 0; j < n; j++) sum += acc.matrix[row + j]
      rowHasOut[i] = sum > 0
      if (sum > 0) {
        anyTransition = true
        for (let j = 0; j < n; j++) P[row + j] = acc.matrix[row + j] / sum
      }
    }
    if (!anyTransition) return new Array<number>(n * n).fill(Number.NaN)
    const Pk = params.step > 1 ? matrixPower(P, n, params.step) : P
    const out = new Array<number>(n * n)
    // A "from" AOI with no out-transitions has an UNDEFINED distribution (0/0),
    // not a row of real 0%. Emit NaN so it drops from cross-participant
    // reduction — the group mean then averages only participants who actually
    // left that AOI, and each such row is genuinely stochastic, so group rows
    // sum to 100% again (the Markov invariant the metric advertises).
    for (let i = 0; i < n; i++) {
      const row = i * n
      for (let j = 0; j < n; j++) {
        out[row + j] = rowHasOut[i] ? Pk[row + j] * 100 : Number.NaN
      }
    }
    return out
  },
})
