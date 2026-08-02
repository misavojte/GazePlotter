import { defineMetric } from '../../core/defineMetric'

interface Acc {
  durations: number[][]
}

/**
 * ## Eye-movement duration
 *
 * Segment duration (ms) of EACH eye-movement type — one value per type on the
 * canonical displayed-name axis, collapsed per participant by
 * `ctx.summaryStatistic`.
 *
 * The recipe carries NO summary param, deliberately (`sampleSummary`): as a
 * VECTOR the metric is the unmarked per-type mean, and distribution plots pool
 * the full per-event sample via `individuals` (median/quartiles/extremes live
 * in their overlay). The Mean/Median/Max/Min choice exists only where a
 * SUMMARY is produced — the `pick-category` projection carries `statistic`
 * ("One type · median"), threaded here by the runtime. Parity in spirit with
 * the aoi-vector duration metrics: same per-participant collapse, same
 * cross-participant reduction order, declared on the summary instead of a
 * recipe param.
 *
 * - **Shape:** `category-vector`
 * - **Unit:** `ms`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (midpoint membership; values are the actual
 *   segment durations, not window-clipped — mirrors `fixationDuration`)
 *
 * ### Parameters
 * None (see `sampleSummary` above).
 *
 * ### Invariants
 * - A type with no segments finalizes to NaN (not 0), so empty types drop
 *   from downstream reduces instead of dragging the collapse.
 * - Accumulates per-slot duration arrays, which `individuals` hands over whole
 *   — every segment duration that contributed, so the beeswarm/box overlays
 *   show the full per-event distribution the summary was taken from.
 */
defineMetric({
  id: 'movementDuration',
  label: 'Eye-movement duration',
  description: 'Per eye-movement type: duration (ms) of segments of that type, collapsed per participant (mean unless a summary projection chooses otherwise). NaN for types the recording contains no segments of; distribution plots pool the raw per-segment sample instead.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  // Intensive: a per-participant central value of segment durations — only
  // `mean` is sound across participants; for the cohort total use movementTime.
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
    // SW-RQA membership for window attribution; the value is the actual
    // segment `duration` (NOT clipped) — "typical saccade length", not
    // "typical overlap with the window". Mirrors fixationDuration.
    if (!frame.midpointInWindow || categorySlot < 0) return
    acc.durations[categorySlot].push(duration)
  },
  individuals: acc => acc.durations,
})
