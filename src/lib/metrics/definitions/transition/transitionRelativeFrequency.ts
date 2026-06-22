import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

/**
 * ## Transition relative frequency
 *
 * Per-cell share of the participant's total transitions, as a percentage.
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `%`
 * - **Category:** `transition`
 * - **Windowing:** supported (matrix-cell / matrix-aggregate inner leaf only).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): `'fixation'` counts consecutive
 *   fixation pairs; `'visit'` counts distinct-AOI transitions only.
 *
 * ### Invariants
 * - Matrix sums to 100% by construction (per participant).
 * - Participants with zero total transitions emit all-NaN — they drop from
 *   cross-participant reduces.
 * - `measurementClass: 'intensive'` — each cell is a per-participant share, so
 *   cross-participant reduction is `mean` (equal-weighted) and summing across
 *   cells is meaningless, restricting `matrix-aggregate` to `max | min`.
 */
defineTransitionMetric<Params>({
  id: 'transitionRelativeFrequency',
  label: 'Transition relative frequency',
  description:
    "Per AOI pair (from → to): share of the participant's total transitions that went from → to, " +
    'expressed as a percentage. Matrix sums to 100% per participant.',
  unit: '%',
  // Intensive: a per-participant share of total transitions. Only `mean` is
  // sound across participants and cells; summing shares yields ~N·share.
  measurementClass: 'intensive',
  searchTags: ['transition', 'frequency', 'relative', 'percent', 'proportion', 'aoi', 'pair'],
  onTransition: (acc, cellIdx) => { acc.matrix[cellIdx]++ },
  finalize: acc => {
    let total = 0
    for (let i = 0; i < acc.matrix.length; i++) total += acc.matrix[i]
    if (total === 0) return new Array<number>(acc.matrix.length).fill(Number.NaN)
    const out = new Array<number>(acc.matrix.length)
    for (let i = 0; i < acc.matrix.length; i++) out[i] = (acc.matrix[i] / total) * 100
    return out
  },
})
