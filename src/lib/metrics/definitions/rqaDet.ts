import { defineSequenceMetric } from '../core/sequenceMetric'
import { integerParam } from '../core/params'

const params = [integerParam('l_min', 'Min line', 2, { min: 2, max: 20 })] as const

defineSequenceMetric({
  id: 'rqaDet',
  label: 'Determinism',
  description: 'Determinism (%): fraction of recurrent fixation pairs forming diagonal lines in the recurrence matrix. High values indicate predictable, repeated scanning paths.',
  unit: '%',
  category: 'rqa-aoi',
  outputShape: 'scalar',
  computationModes: ['global', 'epoch', 'sliding'],
  defaultWindowing: { mode: 'epoch', windowSize: 20, reduction: 'mean' },
  searchTags: ['rqa', 'determinism', 'det', 'diagonal', 'nonlinear', 'aoi', 'sequence'],
  params,
  minLineLength: (p) => p.l_min,
  rqaSelector: (r) => r.DET,
})
