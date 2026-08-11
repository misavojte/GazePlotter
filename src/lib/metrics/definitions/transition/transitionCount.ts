import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

defineTransitionMetric<Params>({
  id: 'transitionCount',
  label: 'Transitions',
  description:
    'Per AOI pair (from → to): count of times gaze transitioned from source AOI to target AOI. ' +
    'In fixation mode every consecutive fixation pair counts; in visit mode only actual AOI changes count.',
  unit: 'count',
  measurementClass: 'extensive',
  // Counts grow with the cohort; use transitionRelativeFrequency for a mean.
  defaultReduction: 'sum',
  searchTags: ['transition', 'matrix', 'pair', 'aoi', 'count', 'sequence', 'markov'],
  onTransition: (acc, cellIdx) => { acc.matrix[cellIdx]++ },
  finalize: acc => Array.from(acc.matrix),
})
