import { defineMetric } from '../../core/defineMetric'

/**
 * ## Absolute dwell time
 *
 * Total time (ms) the participant's gaze dwelled within each AOI across all
 * fixation segments.
 *
 * - **Shape:** `aoi-vector` — one value per AOI slot, plus `noAoi` and
 *   `anyFixation` sentinels.
 * - **Unit:** `ms`
 * - **Category:** `duration`
 * - **Windowing:** supported (time-windowed timeseries via a `windowed`
 *   projection wrapping a scalar leaf such as `pick-aoi` or
 *   `pick-any-fixation`).
 *
 * ### Parameters
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'absoluteTime', baseId: 'absoluteTime', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Absolute dwell time' },
 *   { engine, stimulusId, participantId },
 * )
 * // → { shape: 'aoi-vector', values: [ms_per_slot], ... }
 * ```
 *
 * ### Invariants
 * - Writes to `anyFixationSlot` regardless of AOI membership, so
 *   `pick-any-fixation` is available.
 * - A fixation tagged by multiple raw AOIs mapping to the same slot
 *   contributes once per unique slot (see `runtime.ts` dedup).
 */
defineMetric({
  id: 'absoluteTime',
  label: 'Absolute dwell time',
  description: 'Per AOI: total dwell time (ms) — summed durations of fixations whose dwell covers the AOI. Higher values mean more total attention there.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  // Extensive: a physical duration that adds. Cohort `sum` (total dwell) and
  // per-participant `mean` are both sound, as are sum/mean across matrix cells.
  measurementClass: 'extensive',
  searchTags: ['dwell', 'gaze', 'time', 'absolute', 'total', 'duration', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // Read `frame.duration` (sub-bin overlap with the active window) so a
    // fixation crossing window boundaries contributes only its in-window
    // portion. Across an unbounded scope, frame.duration === fix.duration,
    // so non-windowed queries are unaffected. Matches the legacy
    // aoi-stream collector's per-bin overlap math exactly.
    const dur = frame.duration
    acc[info.anyFixationSlot] += dur
    if (slots.length === 0) acc[info.noAoiSlot] += dur
    else for (let i = 0; i < slots.length; i++) acc[slots[i]] += dur
  },
  finalize: (acc) => Array.from(acc),
})
