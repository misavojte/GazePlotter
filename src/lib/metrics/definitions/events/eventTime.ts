import { defineMetric } from '../../core/defineMetric'

/** The event-axis twin of `absoluteTime`/`movementTime`. A 0 means "none recorded". */
defineMetric({
  id: 'eventTime',
  label: 'Event time',
  description: 'Per event channel: total time (ms) the channel is active. Overlapping occurrences on one channel each count in full, so the total can exceed the range. Instant markers contribute 0.',
  unit: 'ms',
  category: 'events',
  rawShape: 'event-vector',
  windowUnit: 'ms',
  measurementClass: 'extensive',
  searchTags: ['event', 'marker', 'channel', 'time', 'total', 'duration'],
  params: [] as const,
  scanSource: 'events',
  // Divisible time, clipped per window; see absoluteTime.
  windowMembership: 'all',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount),
  onFixation: (acc, { frame, axisSlot }) => {
    // In-window overlap so windowed sums compose; see absoluteTime.
    if (axisSlot < 0) return
    acc[axisSlot] += frame.duration
  },
  finalize: acc => Array.from(acc),
})
