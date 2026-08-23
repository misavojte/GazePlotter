import { defineMetric } from '../../core/defineMetric'

/**
 * First-write-wins per channel slot: movementLatency transposed onto the
 * event axis. The stream is start-sorted, so the first write IS the earliest
 * onset even when concatenated file buffers arrive unsorted. NaN = never
 * occurred; the sentinel is NaN, not -1, because event files permit negative
 * onsets. A stimulus-lifetime concept, so windowing is vetoed like TTFF.
 */
defineMetric({
  id: 'eventLatency',
  label: 'Time to first event',
  description: 'Per event channel: elapsed time (ms) from the start of the stimulus timeline (time = 0) to the first occurrence on that channel. No value if the channel never occurs for the participant.',
  unit: 'ms',
  category: 'events',
  rawShape: 'event-vector',
  windowUnit: 'ms',
  supportsWindowing: false,
  measurementClass: 'intensive',
  searchTags: ['event', 'marker', 'channel', 'latency', 'onset', 'first'],
  params: [] as const,
  scanSource: 'events',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount).fill(Number.NaN),
  // fix.start is the occurrence's actual onset, never the scope-clipped frame.
  onFixation: (acc, { axisSlot, start }) => {
    if (axisSlot < 0) return
    if (Number.isNaN(acc[axisSlot])) acc[axisSlot] = start
  },
  finalize: acc => Array.from(acc),
})
