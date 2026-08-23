import { defineMetric } from '../../core/defineMetric'

/**
 * A 0 means "none recorded" for that participant. The channel axis is a
 * SHAPE: one slot per displayed-name MERGE of the stimulus's channel table;
 * a stimulus with no event channels has an empty axis and an empty vector.
 */
defineMetric({
  id: 'eventCount',
  label: 'Event count',
  description: 'Per event channel: number of occurrences active in the analyzed range or window, instant markers included. An occurrence spanning several windows counts in each of them, so windowed values read as concurrent activity, never as shares of a total. 0 for channels the participant has no occurrences on.',
  unit: 'count',
  category: 'events',
  rawShape: 'event-vector',
  windowUnit: 'ms',
  measurementClass: 'extensive',
  searchTags: ['event', 'marker', 'channel', 'count', 'number', 'occurrence'],
  params: [] as const,
  scanSource: 'events',
  // Presence, not an anchor: the count answers "how many occurrences are
  // ACTIVE here", so an occurrence joins every window it overlaps.
  windowMembership: 'all',
  accumulation: 'stateful',
  init: ({ axisSlotCount }) => new Float64Array(axisSlotCount),
  onFixation: (acc, { axisSlot }) => {
    if (axisSlot < 0) return
    acc[axisSlot]++
  },
  finalize: acc => Array.from(acc),
})
