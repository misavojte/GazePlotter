import { defineMetric } from '../core/defineMetric'

defineMetric({
  id: 'absoluteTime',
  label: 'Absolute dwell time',
  description: "Total time (ms) the participant's gaze dwelled within an AOI across all fixation segments. Higher values indicate more total attention allocated to the region.",
  unit: 'ms',
  category: 'duration',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  defaultWindowing: { mode: 'epoch', windowSize: 2000, reduction: 'mean' },
  searchTags: ['dwell', 'gaze', 'time', 'absolute', 'total', 'duration', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    acc[info.anyFixationSlot] += duration
    if (slots.length === 0) acc[info.noAoiSlot] += duration
    else for (let i = 0; i < slots.length; i++) acc[slots[i]] += duration
  },
  finalize: (acc) => Array.from(acc),
})
