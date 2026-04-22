import { defineMetric } from '../core/defineMetric'

defineMetric({
  id: 'timeToFirstFixation',
  label: 'Time to first fixation',
  description: 'Elapsed time (ms) from stimulus onset until the first fixation on the AOI. Lower values mean the region captured attention earlier. Returns NaN if the AOI was never fixated.',
  unit: 'ms',
  category: 'ttf',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  supportsWindowing: false,
  providesAnyFixation: true,
  searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Array<number>(slots.totalSlots).fill(-1),
  onFixation: (acc, { start, slots }, { slots: info }) => {
    if (acc[info.anyFixationSlot] === -1) acc[info.anyFixationSlot] = start
    if (slots.length === 0) {
      if (acc[info.noAoiSlot] === -1) acc[info.noAoiSlot] = start
      return
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (acc[s] === -1) acc[s] = start
    }
  },
  finalize: (acc) => acc.map(v => v === -1 ? Number.NaN : v),
})
