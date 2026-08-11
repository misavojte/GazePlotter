import { defineRqaMetric } from './defineRqaMetric'

/** `(HL + VL) / 2R` — the standard eye-tracking LAM for a symmetric plot. */
defineRqaMetric({
  id: 'rqaLam',
  label: 'Laminarity',
  description: 'Stimulus-level: laminarity (%) — fraction of recurrent fixation pairs forming vertical or horizontal lines in the recurrence matrix. Higher values indicate the gaze repeatedly dwells on the same AOI before transitioning.',
  searchTags: ['rqa', 'laminarity', 'lam', 'vertical', 'nonlinear', 'aoi', 'sequence'],
  measure: r => r.LAM,
  minLineParam: 'v_min',
})
