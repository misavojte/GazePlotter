import { defineMetric } from '../core/defineMetric'
import { enumParam, integerParam } from '../core/params'
import { initTransitionAcc, processFixation, matrixPower } from '../core/transitionScan'

const params = [
  enumParam('mode', 'Count mode', 'fixation' as 'fixation' | 'visit', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit',    label: 'Visit changes' },
  ]),
  integerParam('step', 'Step', 1, { min: 1, max: 10 }),
] as const

/**
 * Row-normalised transition probability matrix — the classical eye-tracking
 * Markov view. `step = 1` is the direct probability; `step = k > 1` is the
 * k-step matrix power, i.e. P(being at column j after k transitions given the
 * participant is currently at row i).
 *
 * Participants with no transitions out of an AOI get row-of-zeros for that row
 * (not NaN) — "no transitions" is a real observation, not missing data.
 * Participants with NO transitions at all produce an all-NaN matrix so they're
 * excluded from the cross-participant mean.
 *
 * matrix-aggregate projections are automatically rejected by the central
 * validator for row-normalised probability matrices.
 */
defineMetric({
  id: 'transitionProbability',
  label: 'Transition probability',
  description:
    'Row-normalised transition probability matrix (Markov chain view). Cell [i, j] = ' +
    'probability that the next transition from AOI_i lands on AOI_j. k-step mode (step ≥ 2) ' +
    'returns P^k, the probability of arriving at AOI_j after k transitions.',
  unit: '%',
  category: 'transition',
  rawShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  groupAggregation: 'mean',
  defaultLabel: (p) => {
    const modeLabel = p.mode === 'visit' ? 'visit' : 'fixation'
    return `Transition probability (${modeLabel}, ${p.step}-step)`
  },
  searchTags: ['transition', 'probability', 'markov', 'chain', 'aoi', 'pair', 'k-step'],
  params,
  starterInstances: [
    { params: { mode: 'fixation', step: 1 } },
  ],
  init: ({ slots }) => initTransitionAcc(slots.totalSlots),
  onFixation: (acc, fix, { params: p }) => {
    processFixation(acc, fix, p.mode, (cellIdx) => { acc.matrix[cellIdx]++ })
  },
  finalize: (acc, _slots, { params: p }) => {
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
    const Pk = p.step > 1 ? matrixPower(P, n, p.step) : P
    const out = new Array<number>(n * n)
    for (let i = 0; i < n * n; i++) out[i] = Pk[i] * 100
    return out
  },
})
