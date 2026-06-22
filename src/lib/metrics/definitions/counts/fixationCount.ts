import { defineMetric } from '../../core/defineMetric'

/**
 * ## Fixation count
 *
 * Total number of fixations on each AOI. Unlike visit count, every fixation
 * separated by a saccade is counted even within the same visit.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `count`
 * - **Category:** `counts`
 * - **Windowing:** supported
 *
 * ### Parameters
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'fixationCount', baseId: 'fixationCount', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Fixation count' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Increments `anyFixationSlot` once per fixation (not per labelled AOI),
 *   so it matches "how many fixations were there in total" — making
 *   `pick-any-fixation` a meaningful stimulus-level count.
 * - Increments every unique AOI slot the fixation was tagged with, so a
 *   fixation covered by two overlapping AOIs counts in both slots.
 */
defineMetric({
  id: 'fixationCount',
  label: 'Fixation count',
  description: 'Per AOI: count of fixations whose dwell covers it. A fixation tagged with multiple AOIs counts in each. The any-fixation aggregate equals the total fixation count regardless of AOI.',
  unit: 'count',
  category: 'counts',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  // Extensive: a raw count. Cohort `sum` and per-participant `mean` are both
  // sound across participants, and sum/mean are sound across matrix cells.
  measurementClass: 'extensive',
  searchTags: ['fixation', 'count', 'number', 'fix', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // Window membership uses the SW-RQA convention: a fixation belongs to
    // exactly one window — the one whose interval contains its midpoint.
    // For unbounded scopes `midpointInWindow` is always true, so non-
    // windowed queries are unaffected.
    if (!frame.midpointInWindow) return
    acc[info.anyFixationSlot]++
    if (slots.length === 0) { acc[info.noAoiSlot]++; return }
    for (let i = 0; i < slots.length; i++) acc[slots[i]]++
  },
  finalize: (acc) => Array.from(acc),
})
