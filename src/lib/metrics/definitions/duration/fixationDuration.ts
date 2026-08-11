import { defineMetric } from '../../core/defineMetric'

interface Acc { durations: number[][] }

/**
 * No summary param: `sampleSummary` derives finalize by collapsing the
 * per-fixation sample with `ctx.summaryStatistic`, which only a SUMMARY
 * projection can set. Empty slots → NaN, so they drop from reduces.
 */
defineMetric({
  id: 'fixationDuration',
  label: 'Fixation duration',
  description: 'Per AOI: a summary of the durations (ms) of fixations whose dwell covers it, collapsed per participant (mean unless a summary projection chooses otherwise). Longer fixations typically indicate deeper cognitive processing.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  // No `aoiAggregate`: the summary statistic already reduces within each AOI,
  // so an extreme across AOIs would be a double reduction with no reading.
  measurementClass: 'intensive',
  searchTags: ['fixation', 'duration', 'average', 'mean', 'median', 'fix', 'aoi'],
  params: [] as const,
  // A mean over events, not a sum: no additivity to protect, and 'own' would report
  // NaN for a window a fixation plainly covers. Full durations, any overlap.
  windowMembership: 'all',
  accumulation: 'stateful',
  sampleSummary: true,
  init: ({ slots }): Acc => ({ durations: Array.from({ length: slots.totalSlots }, () => []) }),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    // ANY overlap counts, like visitDuration: a fixation the window covers is a
    // fixation in that window, and gating on the midpoint left NaN — a hole — in
    // windows with a fixation plainly inside them. The midpoint rule exists so
    // per-window COUNTS sum to the unwindowed total; a mean is intensive and has
    // no such sum to protect. The value is the ACTUAL duration, not the clipped
    // one — "typical fixation length", not "typical window overlap".
    acc.durations[info.anyFixationSlot].push(duration)
    if (slots.length === 0) { acc.durations[info.noAoiSlot].push(duration); return }
    for (let i = 0; i < slots.length; i++) acc.durations[slots[i]].push(duration)
  },
  individuals: acc => acc.durations,
})
