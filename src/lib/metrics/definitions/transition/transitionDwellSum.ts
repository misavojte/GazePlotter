import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

/** Not a starter — added manually when raw totals beat means. */
defineTransitionMetric<Params>({
  id: 'transitionDwellSum',
  label: 'Transition dwell sum',
  description:
    'Per AOI pair (from → to): sum of pre-transition dwell times before each from → to transition. ' +
    'In fixation mode that\'s the duration of the single preceding fixation; in visit mode, the duration ' +
    'of the preceding visit (consecutive same-AOI fixations merged).',
  unit: 'ms',
  measurementClass: 'extensive',
  // Totals scale with the cohort; use transitionDwellMean for a mean.
  defaultReduction: 'sum',
  searchTags: ['transition', 'dwell', 'duration', 'pair', 'aoi', 'time', 'sum'],
  onTransition: (acc, cellIdx, prevDuration) => {
    acc.matrix[cellIdx] += prevDuration
  },
  finalize: acc => Array.from(acc.matrix),
})
