import { defineMetric } from '../../core/defineMetric'

interface Acc { durations: number[][] }

/**
 * ## Fixation duration
 *
 * A summary of the durations (ms) of individual fixations on each AOI, one
 * value per AOI, collapsed per participant by `ctx.summaryStatistic`. Longer
 * fixations typically indicate deeper cognitive processing of the region.
 * Median is the robust choice for the long right tail typical of
 * fixation-duration distributions.
 *
 * The recipe carries NO summary param, deliberately (`sampleSummary`): as a
 * VECTOR the metric is the unmarked per-AOI mean, and distribution plots pool
 * the full per-fixation sample via `individuals`. The Mean/Median/Max/Min
 * choice exists only where a SUMMARY is produced — `pick-aoi` and
 * `pick-any-fixation` carry `statistic`, threaded here by the runtime. Same
 * declaration as the category-axis duration metric (`movementDuration`).
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `duration`
 * - **Windowing:** supported
 *
 * ### Parameters
 * None (see `sampleSummary` above). `sum` is not among the offered statistics
 * either way — a total of fixation durations is the `absoluteTime` metric.
 *
 * ### Invariants
 * - Accumulates per-slot duration arrays, which `individuals` hands over whole
 *   — every fixation duration that contributed, for the bar-plot overlays. The
 *   summary vector is derived from it (see `sampleSummary`), so the dots and
 *   the bar can never describe different samples.
 * - Slots with no fixations return `NaN` (not `0`) so they drop from
 *   downstream reduces rather than dragging the mean to zero.
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
  // No `aoiAggregate`: the summary `statistic` already reduces within each
  // AOI, so an extreme across AOIs would compose into a double reduction
  // ("min across AOIs of max fixation duration") with no defined reading.
  // Intensive: a per-participant central value of fixation durations. Every
  // offered statistic (mean/median/max/min) stays intensive — only `mean` is
  // sound across participants; for a cohort total of dwell use absoluteTime.
  measurementClass: 'intensive',
  searchTags: ['fixation', 'duration', 'average', 'mean', 'median', 'fix', 'aoi'],
  params: [] as const,
  accumulation: 'stateful',
  sampleSummary: true,
  init: ({ slots }): Acc => ({ durations: Array.from({ length: slots.totalSlots }, () => []) }),
  onFixation: (acc, { frame, duration, slots }, { slots: info }) => {
    // SW-RQA membership for which window this fixation contributes to;
    // value uses the actual fixation `duration` (NOT clipped) — the mean
    // describes "typical fixation length on this AOI", not "typical
    // overlap with the window". `midpointInWindow` is true for unbounded
    // scopes, so non-windowed queries are unaffected.
    if (!frame.midpointInWindow) return
    acc.durations[info.anyFixationSlot].push(duration)
    if (slots.length === 0) { acc.durations[info.noAoiSlot].push(duration); return }
    for (let i = 0; i < slots.length; i++) acc.durations[slots[i]].push(duration)
  },
  individuals: acc => acc.durations,
})
