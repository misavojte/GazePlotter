import { defineMetric } from '../../core/defineMetric'
import { percentShare } from '../../core/numeric'

/**
 * The denominator is `ctx.scopeDurationMs` — recording length, bounded range,
 * or window size — so a per-window share is an honest share of that window.
 * NaN when the scan has no extent: never a share of nothing.
 */
defineMetric({
  id: 'eventTimeShare',
  label: 'Event time share',
  description: 'Per event channel: share (%) of the recording (or the bounded range / window) the channel is active. Overlapping occurrences on one channel each count in full, and an occurrence can outlast the gaze recording, so the share can exceed 100.',
  unit: '%',
  category: 'events',
  rawShape: 'event-vector',
  windowUnit: 'ms',
  // Intensive like movementTimeShare: a real per-participant spread, not a
  // 0/1 indicator.
  measurementClass: 'intensive',
  searchTags: ['event', 'marker', 'channel', 'share', 'proportion', 'percentage', 'time'],
  params: [] as const,
  scanSource: 'events',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount),
  onFixation: (acc, { frame, axisSlot }) => {
    // In-window overlap so windowed shares compose against the window size.
    if (axisSlot < 0) return
    acc[axisSlot] += frame.duration
  },
  finalize: (acc, _slots, { scopeDurationMs }) => percentShare(acc, scopeDurationMs),
})
