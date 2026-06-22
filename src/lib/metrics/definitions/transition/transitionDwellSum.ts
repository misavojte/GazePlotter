import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

/**
 * ## Transition dwell sum
 *
 * Sum of pre-transition fixation/visit durations per AOI pair `[from, to]`.
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `ms`
 * - **Category:** `transition`
 * - **Windowing:** supported (matrix-cell / matrix-aggregate inner leaf).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): in fixation mode, the summed
 *   quantity is the duration of each preceding single fixation; in visit
 *   mode, the total duration of the preceding visit (consecutive same-AOI
 *   fixations merged).
 *
 * ### Invariants
 * - `measurementClass: 'extensive'` — ms totals are summable, so
 *   `matrix-aggregate` with `sum` / `mean` reducers is allowed.
 * - `defaultReduction: 'sum'` — totals scale with participant count.
 *   Use `transitionDwellMean` for cross-participant mean dwell.
 * - Not pre-seeded as a starter; power users add it manually when raw
 *   totals (rather than means) are useful.
 */
defineTransitionMetric<Params>({
  id: 'transitionDwellSum',
  label: 'Transition dwell sum',
  description:
    'Per AOI pair (from → to): sum of pre-transition dwell times before each from → to transition. ' +
    'In fixation mode that\'s the duration of the single preceding fixation; in visit mode, the duration ' +
    'of the preceding visit (consecutive same-AOI fixations merged).',
  unit: 'ms',
  // Extensive: ms totals add. Cohort `sum` is the headline; sum/mean sound across cells.
  measurementClass: 'extensive',
  defaultReduction: 'sum',
  searchTags: ['transition', 'dwell', 'duration', 'pair', 'aoi', 'time', 'sum'],
  onTransition: (acc, cellIdx, prevDuration) => {
    acc.matrix[cellIdx] += prevDuration
  },
  finalize: acc => Array.from(acc.matrix),
})
