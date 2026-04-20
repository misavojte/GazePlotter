import { defineSequenceMetric } from '../core/sequenceMetric'

defineSequenceMetric({
  id: 'rqaRec',
  label: 'Recurrence rate',
  description: "Recurrence rate (%): fraction of fixation sequence pairs that revisit the same AOI. Quantifies how repetitive the participant's gaze pattern is across the stimulus.",
  unit: '%',
  category: 'rqa-aoi',
  outputShape: 'scalar',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
  params: [] as const,
  minLineLength: () => 2,
  rqaSelector: (r) => r.REC,
  scalarOnNoRecurrence: 0,
})
