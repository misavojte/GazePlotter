import { defineMetric } from '../core/defineMetric'
import { integerParam } from '../core/params'
import { rqaScalar } from '../core/rqa'

const params = [integerParam('l_min', 'Min line', 2, { min: 2, max: 20 })] as const

defineMetric({
  id: 'rqaDet',
  label: 'Determinism',
  description: 'Determinism (%): fraction of recurrent fixation pairs forming diagonal lines in the recurrence matrix. High values indicate predictable, repeated scanning paths.',
  unit: '%',
  category: 'rqa-aoi',
  rawShape: 'scalar',
  windowUnit: 'fixations',
  searchTags: ['rqa', 'determinism', 'det', 'diagonal', 'nonlinear', 'aoi', 'sequence'],
  params,
  starterInstances: [{
    projection: {
      kind: 'windowed',
      window: { mode: 'epoch', windowSize: 20 },
      inner: { kind: 'identity-scalar' },
    },
  }],
  init: (): { seq: number[] } => ({ seq: [] }),
  onFixation: (acc, { slots }) => {
    if (slots.length === 1) acc.seq.push(slots[0])
  },
  finalize: (acc, _slots, ctx) =>
    [rqaScalar(acc.seq, ctx.params.l_min, r => r.DET)],
  windowedFinalize: (acc, from, to, ctx) =>
    rqaScalar(acc.seq.slice(from, to), ctx.params.l_min, r => r.DET),
})
