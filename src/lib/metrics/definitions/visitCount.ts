import { defineMetric } from '../core/defineMetric'

interface Acc {
  entries: Float64Array
  previousAois: Set<number>
  wasInNoAoi: boolean
}

defineMetric({
  id: 'averageEntries',
  label: 'Visit count',
  description: 'Number of distinct visits (entries) to the AOI. Each return after leaving counts as a new visit. Reflects revisitation frequency and scanning strategy.',
  unit: 'count',
  category: 'counts',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  searchTags: ['visit', 'entry', 'entries', 'count', 'aoi', 'number', 'transitions'],
  params: [] as const,
  init: ({ slots }): Acc => ({
    entries: new Float64Array(slots.totalSlots),
    previousAois: new Set(),
    wasInNoAoi: false,
  }),
  onFixation: (acc, { slots }, { slots: info }) => {
    if (slots.length === 0) {
      if (!acc.wasInNoAoi) {
        acc.entries[info.noAoiSlot]++
        acc.entries[info.anyFixationSlot]++
        acc.wasInNoAoi = true
      }
      acc.previousAois.clear()
      return
    }
    const setsMatch =
      slots.length === acc.previousAois.size &&
      slots.every(s => acc.previousAois.has(s))
    if (!setsMatch || acc.previousAois.size === 0) acc.entries[info.anyFixationSlot]++
    for (const s of slots) if (!acc.previousAois.has(s)) acc.entries[s]++
    acc.wasInNoAoi = false
    acc.previousAois.clear()
    for (const s of slots) acc.previousAois.add(s)
  },
  finalize: (acc) => Array.from(acc.entries),
})
