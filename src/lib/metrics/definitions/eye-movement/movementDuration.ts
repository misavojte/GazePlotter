import { defineMetric } from '../../core/defineMetric'
import { eyeMovementTypeParam } from './eyeMovementTypeParam'
import { summaryStatisticParam } from '../../core/params'
import { reduceNumeric } from '../../core/projection'

interface Acc {
  durations: number[]
}

/**
 * ## Eye-movement duration
 *
 * A summary (mean by default; also median / max / min) of the durations (ms)
 * of segments of the chosen eye-movement type. The scalar sibling of
 * `fixationDuration` for saccades, blinks, and any other recorded type.
 * (`sum` is deliberately absent — that is the `movementTime` metric.)
 *
 * - **Shape:** `scalar`
 * - **Unit:** `ms`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (midpoint membership; values are the actual
 *   segment durations, not window-clipped — mirrors `fixationDuration`)
 *
 * ### Parameters
 * - `eyeMovementType` — which segment category to measure, by displayed name.
 * - `statistic` — `mean` (default) | `median` | `max` | `min`.
 *
 * ### Invariants
 * - NaN (not 0) when the recording contains no such segments, so empty
 *   participants drop from downstream reduces instead of dragging the mean.
 */
defineMetric({
  id: 'movementDuration',
  label: 'Eye-movement duration',
  description: 'Stimulus-level: a summary (mean by default; also median / max / min) of the durations (ms) of segments of the chosen eye-movement type (by displayed name; saccades by default). NaN when the recording contains no such segments.',
  unit: 'ms',
  category: 'eye-movement',
  rawShape: 'scalar',
  windowUnit: 'ms',
  // Intensive: a per-participant central value of segment durations — only
  // `mean` is sound across participants; for the cohort total use movementTime.
  measurementClass: 'intensive',
  searchTags: ['saccade', 'blink', 'duration', 'mean', 'median', 'eye movement', 'type'],
  params: [eyeMovementTypeParam, summaryStatisticParam] as const,
  scanSource: 'categoryParam',
  accumulation: 'stateful',
  init: (): Acc => ({ durations: [] }),
  onFixation: (acc, { frame, duration }) => {
    // SW-RQA membership for window attribution; the value is the actual
    // segment `duration` (NOT clipped) — "typical saccade length", not
    // "typical overlap with the window". Mirrors fixationDuration.
    if (!frame.midpointInWindow) return
    acc.durations.push(duration)
  },
  finalize: (acc, _slots, { params }) => [reduceNumeric(acc.durations, params.statistic)],
})
