import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

/**
 * ## Transition count
 *
 * Number of times gaze transitioned from AOI `i` (source) to AOI `j` (target).
 *
 * - **Shape:** `aoi-pair-matrix`
 * - **Unit:** `count`
 * - **Category:** `transition`
 * - **Windowing:** supported (but pair-matrix output — windowed use only
 *   meaningful with a `matrix-cell` / `matrix-aggregate` inner leaf).
 *
 * ### Parameters
 * - `mode` (enum, default `'fixation'`): `'fixation'` counts every
 *   consecutive fixation pair; `'visit'` counts only transitions between
 *   distinct AOI visits (collapsing consecutive same-AOI fixations).
 *
 * ### Invariants
 * - `additive: true` — allows `matrix-aggregate` with `sum` / `mean`
 *   reducers (counts are scientifically summable across cells).
 * - Group aggregation is `sum` because counts grow with participant
 *   count; use `transitionRelativeFrequency` for cross-participant means.
 */
defineTransitionMetric<Params>({
  id: 'transitionCount',
  label: 'Transitions',
  description:
    'Per AOI pair (from → to): count of times gaze transitioned from source AOI to target AOI. ' +
    'In fixation mode every consecutive fixation pair counts; in visit mode only actual AOI changes count.',
  unit: 'count',
  groupAggregation: 'sum',
  additive: true,
  defaultLabel: p =>
    p.mode === 'visit'
      ? 'Visit-to-visit transitions'
      : 'Fixation-to-fixation transitions',
  searchTags: ['transition', 'matrix', 'pair', 'aoi', 'count', 'sequence', 'markov'],
  onTransition: (acc, cellIdx) => { acc.matrix[cellIdx]++ },
  finalize: acc => Array.from(acc.matrix),
})
