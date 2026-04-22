import { defineMetric } from '../core/defineMetric'
import { boolParam } from '../core/params'
import { rqaScalar } from '../core/rqa'

const params = [
  boolParam('include_no_aoi', 'Include off-AOI fixations', false),
] as const

defineMetric({
  id: 'rqaRec',
  label: 'Recurrence rate',
  description: "Recurrence rate (%): fraction of fixation sequence pairs that revisit the same AOI. Quantifies how repetitive the participant's gaze pattern is across the stimulus.",
  unit: '%',
  category: 'rqa-aoi',
  rawShape: 'scalar',
  windowUnit: 'fixations',
  searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
  params,
  init: (): { seq: number[] } => ({ seq: [] }),
  onFixation: (acc, { slots }, { slots: info, params }) => {
    if (slots.length === 1) acc.seq.push(slots[0])
    else if (params.include_no_aoi && slots.length === 0) acc.seq.push(info.noAoiSlot)
  },
  finalize: (acc) => [rqaScalar(acc.seq, 2, r => r.REC, 0)],
  windowedFinalize: (acc, from, to) =>
    rqaScalar(acc.seq.slice(from, to), 2, r => r.REC, 0),
})
