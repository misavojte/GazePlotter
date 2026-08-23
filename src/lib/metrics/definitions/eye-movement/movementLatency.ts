import { defineMetric } from '../../core/defineMetric'

/**
 * First-write-wins per type slot: timeToFirstFixation transposed onto the
 * category axis. NaN = never occurred; a type the recording never contains
 * is "no value", never 0 (contrast movementCount). The sentinel is NaN, not
 * TTFF's -1: workspace JSON permits negative onsets, so -1 is in-band here.
 * Latency is a stimulus-lifetime concept, so windowing is vetoed like TTFF.
 */
defineMetric({
  id: 'movementLatency',
  label: 'Time to first eye movement',
  description: 'Per eye-movement type: elapsed time (ms) from the start of the stimulus timeline (time = 0) to the start of the first segment of that type. Picked at Saccade this is the time to first saccade (saccadic latency). No value if the type never occurs in the recording.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  supportsWindowing: false,
  measurementClass: 'intensive',
  searchTags: ['saccade', 'saccadic latency', 'latency', 'reaction time', 'srt', 'onset', 'first', 'blink', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount).fill(Number.NaN),
  // fix.start is the segment's actual onset, never the scope-clipped frame.
  onFixation: (acc, { axisSlot, start }) => {
    if (axisSlot < 0) return
    if (Number.isNaN(acc[axisSlot])) acc[axisSlot] = start
  },
  finalize: acc => Array.from(acc),
})
