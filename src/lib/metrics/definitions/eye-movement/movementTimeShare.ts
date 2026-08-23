import { defineMetric } from '../../core/defineMetric'
import { percentShare } from '../../core/numeric'

/**
 * The denominator is `ctx.scopeDurationMs` — recording length, bounded range,
 * or window size — so a per-window share is an honest share of that window.
 * NaN when the scan has no extent: never a share of nothing.
 */
defineMetric({
  id: 'movementTimeShare',
  label: 'Eye-movement time share',
  description: 'Per eye-movement type: share (%) of the recording (or the bounded range / window) spent in segments of that type. 0 for types the recording contains no segments of.',
  unit: '%',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  // Intensive like `relativeTime`, NOT `proportion` — that class is a 0/1
  // indicator (`fixated`) and offers no distribution statistics, whereas this
  // percentage has a real per-participant spread worth an overlay.
  measurementClass: 'intensive',
  searchTags: ['saccade', 'blink', 'share', 'proportion', 'percentage', 'time', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount),
  onFixation: (acc, { frame, axisSlot }) => {
    // In-window overlap so windowed shares compose against the window size.
    if (axisSlot < 0) return
    acc[axisSlot] += frame.duration
  },
  finalize: (acc, _slots, { scopeDurationMs }) => percentShare(acc, scopeDurationMs),
})
