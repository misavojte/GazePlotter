import { defineMetric } from '../../core/defineMetric'
import type { FixationEvent } from '../../core/dsl'

export function defineFirstHitMetric(spec: {
  id: string
  label: string
  description: string
  searchTags: string[]
  aoiAggregate?: { min: string; max: string }
  extractValue: (fix: FixationEvent) => number
}): void {
  defineMetric({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    unit: 'ms',
    category: 'ttf',
    rawShape: 'aoi-vector',
    windowUnit: 'ms',
    supportsWindowing: false,
    providesAnyFixation: true,
    aoiAggregate: spec.aoiAggregate,
    measurementClass: 'intensive',
    searchTags: spec.searchTags,
    params: [] as const,
    accumulation: 'stateful',
    init: ({ slots }) => new Array<number>(slots.totalSlots).fill(-1),
    onFixation: (acc, fix, { slots: info }) => {
      const { slots } = fix
      const val = spec.extractValue(fix)
      if (acc[info.anyFixationSlot] === -1) acc[info.anyFixationSlot] = val
      if (slots.length === 0) {
        if (acc[info.noAoiSlot] === -1) acc[info.noAoiSlot] = val
        return
      }
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]
        if (acc[s] === -1) acc[s] = val
      }
    },
    finalize: (acc) => acc.map(v => v === -1 ? Number.NaN : v),
  })
}
