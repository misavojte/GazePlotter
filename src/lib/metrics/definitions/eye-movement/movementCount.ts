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
  accumulation: 'stateful',
  init: ({ categorySlotCount }) => new Float64Array(categorySlotCount),
  onFixation: (acc, { frame, categorySlot }) => {
    // SW-RQA membership; see fixationCount.
    if (!frame.midpointInWindow || categorySlot < 0) return
    acc[categorySlot]++
  },
  finalize: acc => Array.from(acc),
})
