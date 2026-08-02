import { defineMetric } from '../../core/defineMetric'

interface Acc {
  durations: number[][]
}

/** The category-axis twin of `fixationDuration`; same `sampleSummary` rule. */
defineMetric({
  id: 'movementDuration',
  label: 'Eye-movement duration',
  description: 'Per eye-movement type: duration (ms) of segments of that type, collapsed per participant (mean unless a summary projection chooses otherwise). NaN for types the recording contains no segments of; distribution plots pool the raw per-segment sample instead.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  // Intensive, not extensive: for the cohort total use movementTime.
  measurementClass: 'intensive',
  searchTags: ['saccade', 'blink', 'duration', 'mean', 'median', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  accumulation: 'stateful',
  sampleSummary: true,
  init: ({ categorySlotCount }): Acc => ({
    durations: Array.from({ length: categorySlotCount }, () => []),
  }),
  onFixation: (acc, { frame, duration, categorySlot }) => {
    // Actual segment `duration`, NOT clipped — "typical saccade length", not
    // "typical overlap with the window". Mirrors fixationDuration.
    if (!frame.midpointInWindow || categorySlot < 0) return
    acc.durations[categorySlot].push(duration)
  },
  individuals: acc => acc.durations,
})
