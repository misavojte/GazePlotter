import { defineMetric } from '../../core/defineMetric'

/**
 * ## Relative dwell time
 *
 * Dwell time per AOI as a percentage of the participant's total fixation time
 * on the stimulus. Normalises attention across participants with different
 * overall scan durations.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `%`
 * - **Category:** `duration`
 * - **Windowing:** supported
 *
 * ### Parameters
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'relativeTime', baseId: 'relativeTime', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Relative dwell time' },
 *   { engine, stimulusId, participantId },
 * )
 * // → { shape: 'aoi-vector', values: [percent_per_slot], ... }
 * ```
 *
 * ### Invariants
 * - Normalised by `anyFixationSlot` total, NOT the sum across AOI slots —
 *   summing AOI slots would double-count every fixation (once in its slot,
 *   once in anyFixation) and halve every percentage.
 * - A participant (or window) with zero total fixation time has an UNDEFINED
 *   relative dwell (0/0): every slot is `NaN`, not 0, so it drops out of
 *   cross-participant / cross-window reduction instead of deflating the mean.
 *   (A participant who HAS fixations but none on AOI X legitimately gets 0% on
 *   X — that case keeps a real 0, only the zero-total case is NaN.)
 */
defineMetric({
  id: 'relativeTime',
  label: 'Relative dwell time',
  description: "Per AOI: dwell time as a percentage of the participant's total fixation time on the stimulus. Normalises attention across participants with different overall scan durations.",
  unit: '%',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  // Intensive: each value is already a per-participant share (0..100%). Only
  // `mean` is sound across participants — summing shares yields `≈ N · share`
  // with no physical meaning (for a cohort total use absoluteTime, which is
  // extensive). The class alone forbids `sum`; no per-recipe guard needed.
  measurementClass: 'intensive',
  searchTags: ['dwell', 'gaze', 'time', 'relative', 'percent', 'proportion', 'duration', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // See absoluteTime — read `frame.duration` so windowed totals don't
    // double-count fixations spanning bin boundaries.
    const dur = frame.duration
    acc[info.anyFixationSlot] += dur
    if (slots.length === 0) acc[info.noAoiSlot] += dur
    else for (let i = 0; i < slots.length; i++) acc[slots[i]] += dur
  },
  finalize: (acc, slots) => {
    // Normalise by total fixation time (the anyFixation slot), NOT by the sum
    // of all slots — that would double-count every fixation (once in its AOI
    // slot, once in anyFixation) and halve every reported percentage.
    const total = acc[slots.anyFixationSlot]
    const out = new Array<number>(acc.length)
    // total === 0 → 0/0 is undefined (no gaze to normalise against): NaN, not a
    // real 0% that would deflate group/window means. acc[i] === 0 with total > 0
    // is a genuine 0% (fixated elsewhere, not here) and stays 0.
    for (let i = 0; i < acc.length; i++)
      out[i] = total > 0 ? (acc[i] / total) * 100 : Number.NaN
    return out
  },
})
