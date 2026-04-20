import { defineMetric } from '../core/defineMetric'

interface Acc { durations: number[][] }

defineMetric({
  id: 'avgFixationDuration',
  label: 'Fixation duration',
  description: 'Mean duration (ms) of individual fixations on the AOI. Longer fixations typically indicate deeper cognitive processing.',
  unit: 'ms',
  category: 'duration',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['fixation', 'duration', 'average', 'mean', 'fix', 'aoi'],
  params: [] as const,
  init: ({ slots }): Acc => ({ durations: Array.from({ length: slots.totalSlots }, () => []) }),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    acc.durations[info.anyFixationSlot].push(duration)
    if (slots.length === 0) { acc.durations[info.noAoiSlot].push(duration); return }
    for (let i = 0; i < slots.length; i++) acc.durations[slots[i]].push(duration)
  },
  finalize: (acc) => acc.durations.map(arr => {
    if (arr.length === 0) return Number.NaN
    let sum = 0
    for (const d of arr) sum += d
    return sum / arr.length
  }),
  individuals: (acc, slotIndex) => acc.durations[slotIndex] ?? [],
})
