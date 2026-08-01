import { defineMetric } from '../../core/defineMetric'
import { enumParam } from '../../core/params'
import { reduceNumeric } from '../../core/projection'

interface Acc {
  gaps: number[]
  prevEnd: number
}

/**
 * ## Inter-fixation interval
 *
 * A summary (mean by default; also median / max / min) of the gaps (ms)
 * between consecutive fixations. The gap spans whatever happened between two
 * fixations — saccades, blinks, and tracking loss are indistinguishable here —
 * so it works on every dataset, including the fixation-only formats that
 * record no saccade segments at all.
 *
 * - **Shape:** `scalar`
 * - **Unit:** `ms`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (gaps between consecutive fixations overlapping
 *   the same window)
 *
 * ### Parameters
 * - `statistic` — how the per-gap values are collapsed to the per-participant
 *   value: `mean` (default) | `median` | `max` | `min`.
 *
 * ### Invariants
 * - Only POSITIVE gaps count. Pre-segmented exports often store fixations
 *   back-to-back (end == next start); those carry no inter-fixation episode,
 *   and counting them as 0 would drag the mean toward a fake floor. With no
 *   positive gap the metric is NaN (not measurable), never 0.
 * - Gap values are actual times (window-naive); a window only determines
 *   WHICH fixation pairs contribute, mirroring `fixationDuration`'s choice.
 */
defineMetric({
  id: 'interFixationInterval',
  label: 'Inter-fixation interval',
  description: 'Stimulus-level: a summary (mean by default; also median / max / min) of the gaps (ms) between consecutive fixations. A gap spans everything between two fixations — saccades, blinks, and tracking loss are indistinguishable. Back-to-back fixations (zero gap) are excluded; NaN when no positive gap exists.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'scalar',
  windowUnit: 'ms',
  // Intensive: a per-participant central value of gap durations — only `mean`
  // is sound across participants.
  measurementClass: 'intensive',
  searchTags: ['saccade', 'intersaccadic', 'interval', 'gap', 'between', 'fixation', 'eye movement'],
  params: [
    enumParam<'statistic', 'mean' | 'median' | 'max' | 'min'>('statistic', 'Summary', 'mean', [
      { value: 'mean', label: 'Mean' },
      { value: 'median', label: 'Median' },
      { value: 'max', label: 'Max' },
      { value: 'min', label: 'Min' },
    ]),
  ] as const,
  accumulation: 'stateful',
  init: (): Acc => ({ gaps: [], prevEnd: -1 }),
  onFixation: (acc, { start, duration }) => {
    // Consecutive within the current scan: unwindowed that is all fixations;
    // windowed it is the fixations overlapping this window, so a gap belongs
    // to the window(s) containing both its flanking fixations.
    if (acc.prevEnd >= 0) {
      const gap = start - acc.prevEnd
      if (gap > 0) acc.gaps.push(gap)
    }
    acc.prevEnd = start + duration
  },
  finalize: (acc, _slots, { params }) => [reduceNumeric(acc.gaps, params.statistic)],
})
