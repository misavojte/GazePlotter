import { defineMetric } from '../core/defineMetric'

defineMetric({
  id: 'timeToFirstFixation',
  label: 'Time to first fixation',
  description: 'Elapsed time (ms) from stimulus onset until the first fixation on the AOI. Lower values mean the region captured attention earlier. Returns NaN if the AOI was never fixated.',
  unit: 'ms',
  category: 'ttf',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
  params: [] as const,
  // Aggregating "first times" across AOIs is only interpretable as `min`
  // (= time until attention first landed anywhere) or `max` (= time until
  // every AOI had been looked at). Mean/median/sum of first-times mix
  // apples and oranges — hide them.
  rejectedProjections: (p) => {
    if (p.target === 'scalar' && p.from === 'aggregate-aoi') {
      if (p.reducer === 'mean' || p.reducer === 'median' || p.reducer === 'sum') {
        return 'Use min (earliest AOI fixated) or max (latest AOI fixated) — other aggregates of first-times are not meaningful.'
      }
    }
    return null
  },
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
