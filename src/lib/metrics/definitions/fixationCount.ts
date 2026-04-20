import { defineMetric } from '../core/defineMetric'

defineMetric({
  id: 'averageFixationCount',
  label: 'Fixation count',
  description: 'Total count of fixations on the AOI. Unlike visit count, each fixation separated by a saccade is counted even within the same visit.',
  unit: 'count',
  category: 'counts',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  searchTags: ['fixation', 'count', 'number', 'fix', 'aoi'],
  params: [] as const,
  starterInstances: [{
    projection: {
      kind: 'windowed',
      window: { mode: 'epoch', windowSize: 2000 },
      inner: { kind: 'aggregate-aoi', reducer: 'mean' },
    },
  }],
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { slots }, { slots: info }) => {
    acc[info.anyFixationSlot]++
    if (slots.length === 0) { acc[info.noAoiSlot]++; return }
    for (let i = 0; i < slots.length; i++) acc[slots[i]]++
  },
  finalize: (acc) => Array.from(acc),
})
