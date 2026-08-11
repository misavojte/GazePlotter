import { defineTransitionMetric } from '../../core/defineTransitionMetric'
import { integerParam } from '../../core/params'
import { matrixPower } from '../../core/transitionScan'

interface Params { mode: 'fixation' | 'visit'; step: number }

/**
 * `step = 1` rows sum to 100% per participant. `step = k > 1` rows may sum to
 * LESS: the missing mass is the probability the recording ended before `k`
 * transitions out of `i`. The visible cells stay exact — `P^k[i][j]` is the
 * probability among trajectories that survived.
 *
 * NaN rows (no out-transition) drop from the cross-participant mean, so group
 * rows are averaged only over participants who left that AOI and stay
 * row-stochastic at `step = 1`.
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
  measurementClass: 'intensive',
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
    // not a row of real 0% — NaN so it drops from the reduce (see above).
    for (let i = 0; i < n; i++) {
      const row = i * n
      for (let j = 0; j < n; j++) {
        out[row + j] = rowHasOut[i] ? Pk[row + j] * 100 : Number.NaN
      }
    }
    return out
  },
})
