import { defineMetric } from '../core/defineMetric'

defineMetric({
  id: 'avgFirstFixationDuration',
  label: 'First fixation duration',
  description: 'Duration (ms) of the very first fixation on the AOI. Reflects initial processing depth upon first encounter. Returns NaN if the AOI was never fixated.',
  unit: 'ms',
  category: 'ttf',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  supportsWindowing: false,
  providesAnyFixation: true,
  searchTags: ['first', 'fixation', 'duration', 'ttf', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Array<number>(slots.totalSlots).fill(-1),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    if (acc[info.anyFixationSlot] === -1) acc[info.anyFixationSlot] = duration
    if (slots.length === 0) {
      if (acc[info.noAoiSlot] === -1) acc[info.noAoiSlot] = duration
      return
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (acc[s] === -1) acc[s] = duration
    }
  },
  finalize: (acc) => acc.map(v => v === -1 ? Number.NaN : v),
})
