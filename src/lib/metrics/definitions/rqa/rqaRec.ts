import { defineRqaMetric } from './defineRqaMetric'

defineRqaMetric({
  id: 'rqaRec',
  label: 'Recurrence rate',
  description: "Stimulus-level: recurrence rate (%) — fraction of fixation-sequence pairs that revisit the same AOI. Higher values indicate a more repetitive gaze pattern across the stimulus.",
  searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
  measure: r => r.REC,
  onNoRecurrence: 0,
})
