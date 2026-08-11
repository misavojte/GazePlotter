import { defineMetric } from '../../core/defineMetric'

/** The category-axis twin of `absoluteTime`. A 0 means "none recorded". */
defineMetric({
  id: 'movementTime',
  label: 'Eye-movement time',
  description: 'Per eye-movement type: total time (ms) spent in segments of that type. 0 for types the recording contains no segments of.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  measurementClass: 'extensive',
  searchTags: ['saccade', 'blink', 'time', 'total', 'duration', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  // Divisible time, clipped per window; see absoluteTime.
  windowMembership: 'all',
  accumulation: 'stateful',
  init: ({ categorySlotCount }) => new Float64Array(categorySlotCount),
  onFixation: (acc, { frame, categorySlot }) => {
    // In-window overlap so windowed sums compose; see absoluteTime.
    if (categorySlot < 0) return
    acc[categorySlot] += frame.duration
  },
  finalize: acc => Array.from(acc),
})
