import { defineTransitionMetric } from '../../core/defineTransitionMetric'
import { percentShare } from '../../core/numeric'

interface Params { mode: 'fixation' | 'visit' }

/** Zero-transition participants emit all-NaN, so they drop from reduces. */
defineTransitionMetric<Params>({
  id: 'transitionRelativeFrequency',
  label: 'Transition relative frequency',
  description:
    "Per AOI pair (from → to): share of the participant's total transitions that went from → to, " +
    'expressed as a percentage. Matrix sums to 100% per participant.',
  unit: '%',
  measurementClass: 'intensive',
  searchTags: ['transition', 'frequency', 'relative', 'percent', 'proportion', 'aoi', 'pair'],
  onTransition: (acc, cellIdx) => { acc.matrix[cellIdx]++ },
  finalize: acc => {
    let total = 0
    for (let i = 0; i < acc.matrix.length; i++) total += acc.matrix[i]
    return percentShare(acc.matrix, total)
  },
})
