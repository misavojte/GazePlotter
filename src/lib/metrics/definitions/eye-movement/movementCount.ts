import { defineMetric } from '../../core/defineMetric'

/**
 * A 0 means "none recorded", not "none occurred" — fixation-only sources
 * record no saccades or blinks. The Fixation slot must equal fixationCount's
 * any-fixation total: the equivalence pin for the category scan.
 */
defineMetric({
  id: 'movementCount',
  label: 'Eye-movement count',
  description: 'Per eye-movement type: count of segments of that type. A type the recording cannot contain (fixation-only sources) counts 0.',
  unit: 'count',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  measurementClass: 'extensive',
  searchTags: ['saccade', 'blink', 'fixation', 'count', 'number', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  // Indivisible events; see fixationCount.
  windowMembership: 'own',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount),
  onFixation: (acc, { axisSlot }) => {
    if (axisSlot < 0) return
    acc[axisSlot]++
  },
  finalize: acc => Array.from(acc),
})
