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
 * - Participants with zero total fixation time get all-zero output.
 */
defineMetric({
  id: 'relativeTime',
  label: 'Relative dwell time',
  description: "Per AOI: dwell time as a percentage of the participant's total fixation time on the stimulus. Normalises attention across participants with different overall scan durations.",
  unit: '%',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  searchTags: ['dwell', 'gaze', 'time', 'relative', 'percent', 'proportion', 'duration', 'aoi'],
  params: [] as const,
  // Cross-participant `sum` over a windowed projection is incoherent here:
  // each participant's per-window value is already a per-participant share
  // (0..100); summing across N participants yields a scalar of
  // `≈ N · share` with no physical meaning. Mean/median preserve the
  // "share" semantics.
  groupAggregationGuard: (projection, method) => {
    if (projection.kind === 'windowed' && method === 'sum') {
      return 'Cross-participant `sum` of relativeTime over a windowed projection is not meaningful — each participant\'s per-window value is already a per-participant share. Use `mean` or `median`.'
    }
    return null
  },
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
    for (let i = 0; i < acc.length; i++) out[i] = total > 0 ? (acc[i] / total) * 100 : 0
    return out
  },
})
