import { defineMetric } from '../core/defineMetric'
import { rqaScalar } from '../core/rqa'

defineMetric({
  id: 'rqaRec',
  label: 'Recurrence rate',
  description: "Recurrence rate (%): fraction of fixation sequence pairs that revisit the same AOI. Quantifies how repetitive the participant's gaze pattern is across the stimulus.",
  unit: '%',
  category: 'rqa-aoi',
  outputShape: 'scalar',
  windowUnit: 'fixations',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
  params: [] as const,
  init: (): { seq: number[] } => ({ seq: [] }),
  onFixation: (acc, { slots }) => {
    if (slots.length === 1) acc.seq.push(slots[0])
  },
  finalize: (acc) => [rqaScalar(acc.seq, 2, r => r.REC, 0)],
  windowedFinalize: (acc, from, to) =>
    rqaScalar(acc.seq.slice(from, to), 2, r => r.REC, 0),
})
