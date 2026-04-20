import { defineMetric } from '../core/defineMetric'

defineMetric({
  id: 'relativeTime',
  label: 'Relative dwell time',
  description: 'Dwell time as a percentage of total fixation time on the stimulus. Normalises attention across participants with different overall scan durations.',
  unit: '%',
  category: 'duration',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['dwell', 'gaze', 'time', 'relative', 'percent', 'proportion', 'duration', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    acc[info.anyFixationSlot] += duration
    if (slots.length === 0) acc[info.noAoiSlot] += duration
    else for (let i = 0; i < slots.length; i++) acc[slots[i]] += duration
  },
  finalize: (acc, slots) => {
    // Normalise by total fixation time (the anyFixation slot), NOT by the sum
    // of all slots — that would double-count every fixation (once in its AOI
    // slot, once in anyFixation) and halve every reported percentage.
    const total = acc[slots.anyFixationSlot]
    const out = new Array<number>(acc.length)
    for (let i = 0; i < acc.length; i++) out[i] = total > 0 ? (acc[i] / total) * 100 : 0
    return out
  },
})
