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
 * - `step` (integer, default `1`, range 1–10): k-step matrix power —
 *   `step = 1` is the direct probability; `step = k > 1` returns `P^k`,
 *   the probability of arriving at AOI `j` after `k` transitions.
 *
 * ### Invariants
 * - Rows sum to 100% (or 0% for "no transitions out" rows — distinguished
 *   from NaN, which signals the participant had zero transitions total).
 * - Not `additive` — row-stochastic matrices are not summable across cells.
 *   `matrix-aggregate` is restricted to `max | min` by the validator.
 * - Group aggregation is `mean` — each participant contributes one P matrix,
 *   equal-weighted.
 */
defineTransitionMetric<Params>({
  id: 'transitionProbability',
  label: 'Transition probability',
  description:
    'Per AOI pair (row → column): row-normalised transition probability — the probability that the ' +
    'next transition out of row-AOI lands on column-AOI (Markov-chain view). With step ≥ 2, returns ' +
    'P^k — the probability of arriving at column-AOI after k transitions.',
  unit: '%',
  groupAggregation: 'mean',
  defaultLabel: p => {
    const modeLabel = p.mode === 'visit' ? 'visit' : 'fixation'
    return `Transition probability (${modeLabel}, ${p.step}-step)`
  },
  searchTags: ['transition', 'probability', 'markov', 'chain', 'aoi', 'pair', 'k-step'],
  extraParams: [integerParam('step', 'Step', 1, { min: 1, max: 10 })],
  onTransition: (acc, cellIdx) => { acc.matrix[cellIdx]++ },
  finalize: (acc, params) => {
    const n = acc.size
    let anyTransition = false
    const P = new Float64Array(n * n)
    for (let i = 0; i < n; i++) {
      const row = i * n
      let sum = 0
      for (let j = 0; j < n; j++) sum += acc.matrix[row + j]
      if (sum > 0) {
        anyTransition = true
        for (let j = 0; j < n; j++) P[row + j] = acc.matrix[row + j] / sum
      }
    }
    if (!anyTransition) return new Array<number>(n * n).fill(Number.NaN)
    const Pk = params.step > 1 ? matrixPower(P, n, params.step) : P
    const out = new Array<number>(n * n)
    for (let i = 0; i < n * n; i++) out[i] = Pk[i] * 100
    return out
  },
})
