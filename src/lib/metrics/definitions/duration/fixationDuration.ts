import { defineMetric } from '../../core/defineMetric'
import { enumParam } from '../../core/params'
import { reduceNumeric } from '../../core/projection'

interface Acc { durations: number[][] }

/**
 * ## Fixation duration
 *
 * A summary (mean by default; also median / max / min) of the durations (ms) of
 * individual fixations on each AOI. Longer fixations typically indicate deeper
 * cognitive processing of the region. Median is the robust choice for the long
 * right tail typical of fixation-duration distributions.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `duration`
 * - **Windowing:** supported
 *
 * ### Parameters
 * - `statistic` — how each AOI-slot's per-fixation durations are collapsed to
 *   the per-participant value: `mean` (default) | `median` | `max` | `min`.
 *   (`sum` is deliberately absent — that is the `absoluteTime` metric.)
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'fixationDuration', baseId: 'fixationDuration', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Fixation duration' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Accumulates per-slot duration arrays so `individuals(slotIndex)` can
 *   return every fixation duration that contributed to the mean — used by
 *   bar-plot box overlays.
 * - Slots with no fixations return `NaN` (not `0`) so they drop from
 *   downstream reduces rather than dragging the mean to zero.
 */
defineMetric({
  id: 'fixationDuration',
  label: 'Fixation duration',
  description: 'Per AOI: a summary (mean by default; also median / max / min) of the durations (ms) of fixations whose dwell covers it. Longer fixations typically indicate deeper cognitive processing.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  // No `aoiAggregate`: the settable `statistic` already reduces within each
  // AOI, so an extreme across AOIs would compose into a double reduction
  // ("min across AOIs of max fixation duration") with no defined reading.
  // Intensive: a per-participant central value of fixation durations. Every
  // offered statistic (mean/median/max/min) stays intensive — only `mean` is
  // sound across participants; for a cohort total of dwell use absoluteTime.
  measurementClass: 'intensive',
  searchTags: ['fixation', 'duration', 'average', 'mean', 'median', 'fix', 'aoi'],
  params: [
    enumParam<'statistic', 'mean' | 'median' | 'max' | 'min'>('statistic', 'Summary', 'mean', [
      { value: 'mean', label: 'Mean' },
      { value: 'median', label: 'Median' },
      { value: 'max', label: 'Max' },
      { value: 'min', label: 'Min' },
    ]),
  ] as const,
  accumulation: 'stateful',
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
  // Collapse each slot's per-fixation durations by the chosen statistic
  // (default mean). `individuals` stays the full per-fixation sample, so box /
  // beeswarm overlays always show the distribution regardless of this choice.
  finalize: (acc, _slots, { params }) =>
    acc.durations.map(arr => reduceNumeric(arr, params.statistic)),
  individuals: (acc, slotIndex) => acc.durations[slotIndex] ?? [],
})
