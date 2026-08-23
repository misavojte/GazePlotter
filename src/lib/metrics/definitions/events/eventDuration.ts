import { defineMetric } from '../../core/defineMetric'

interface Acc {
  durations: number[][]
}

/** The event-axis twin of `movementDuration`; same `sampleSummary` rule. */
defineMetric({
  id: 'eventDuration',
  label: 'Event duration',
  description: 'Per event channel: duration (ms) of occurrences on that channel, collapsed per participant (mean unless a summary projection chooses otherwise). An instant marker has zero extent and stays in the sample as a genuine 0. NaN for channels the participant has no occurrences on; distribution plots pool the raw per-occurrence sample instead.',
  unit: 'ms',
  category: 'events',
  rawShape: 'event-vector',
  windowUnit: 'ms',
  // Intensive, not extensive: for the cohort total use eventTime.
  measurementClass: 'intensive',
  searchTags: ['event', 'marker', 'channel', 'duration', 'mean', 'median', 'interval'],
  params: [] as const,
  scanSource: 'events',
  // Mean over occurrences; see fixationDuration.
  windowMembership: 'all',
  accumulation: 'stateful',
  sampleSummary: true,
  init: ({ axisSlotCount }): Acc => ({
    durations: Array.from({ length: axisSlotCount }, () => []),
  }),
  onFixation: (acc, { duration, axisSlot }) => {
    // Actual occurrence `duration`, NOT clipped — "typical occurrence length",
    // not "typical overlap with the window". Mirrors movementDuration.
    if (axisSlot < 0) return
    acc.durations[axisSlot].push(duration)
  },
  individuals: acc => acc.durations,
})
