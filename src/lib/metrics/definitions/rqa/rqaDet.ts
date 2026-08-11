import { defineRqaMetric } from './defineRqaMetric'

defineRqaMetric({
  id: 'rqaDet',
  label: 'Determinism',
  description: 'Stimulus-level: determinism (%) — fraction of recurrent fixation pairs forming diagonal lines in the recurrence matrix. Higher values indicate predictable, repeated scan paths.',
  searchTags: ['rqa', 'determinism', 'det', 'diagonal', 'nonlinear', 'aoi', 'sequence'],
  measure: r => r.DET,
  minLineParam: 'l_min',
})
