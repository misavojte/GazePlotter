import { defineSequenceMetric } from '../core/sequenceMetric'
import { integerParam } from '../core/params'

const params = [integerParam('v_min', 'Min line', 2, { min: 2, max: 20 })] as const

defineSequenceMetric({
  id: 'rqaLam',
  label: 'Laminarity',
  description: 'Laminarity (%): fraction of recurrent fixation pairs forming vertical lines in the recurrence matrix. High values indicate the gaze repeatedly dwells on the same AOI before transitioning.',
  unit: '%',
  category: 'rqa-aoi',
  outputShape: 'scalar',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['rqa', 'laminarity', 'lam', 'vertical', 'nonlinear', 'aoi', 'sequence'],
  params,
  minLineLength: (p) => p.v_min,
  rqaSelector: (r) => r.LAM,
})
