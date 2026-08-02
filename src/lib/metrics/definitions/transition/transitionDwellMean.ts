import { defineTransitionMetric } from '../../core/defineTransitionMetric'

interface Params { mode: 'fixation' | 'visit' }

/**
 * Cross-participant this is a mean of per-participant means, so every
 * participant weighs the same regardless of transition count (the standard
 * eye-tracking reporting); non-observing ones drop via NaN.
 */
defineTransitionMetric<Params>({
  id: 'transitionDwellMean',
  label: 'Mean transition dwell time',
  description:
    'Per AOI pair (from → to): mean pre-transition dwell time before each from → to transition. ' +
    'In fixation mode that\'s the duration of the single preceding fixation; in visit mode, the duration ' +
    'of the preceding visit.',
  unit: 'ms',
  // Intensive, not extensive: for a cohort total use transitionDwellSum.
  measurementClass: 'intensive',
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
