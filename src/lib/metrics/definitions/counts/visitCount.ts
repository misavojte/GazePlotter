import { defineMetric } from '../../core/defineMetric'

interface Acc {
  entries: Float64Array
  previousAois: Set<number>
  wasInNoAoi: boolean
}

/**
 * ## Visit count
 *
 * Number of distinct visits (entries) to each AOI. Each return after leaving
 * counts as a new visit. Reflects revisitation frequency and scanning
 * strategy.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `count`
 * - **Category:** `counts`
 * - **Windowing:** supported
 *
 * ### Parameters
 * None.
 *
 * ### Invariants
 * - Increments slot `s` only if `s` was NOT in the previous fixation's slot
 *   set; a visit is a transition from absent → present.
 * - `anyFixationSlot` counts RUNS OF CONSTANT AOI SET: it increments on any
 *   set-of-slots change, including when the set becomes empty, so off-AOI
 *   runs count as runs like any other. Same convention as `visitDuration`'s
 *   any-fixation slot (pinned equal in metricFormulas.test.ts) and as
 *   `anyFixation` everywhere else: all fixations, AOIs ignored.
 * - Off-AOI runs collapse to a single visit of `noAoiSlot`.
 */
defineMetric({
  id: 'visitCount',
  label: 'Visit count',
  description: 'Per AOI: count of distinct visits — entries into the AOI separated by at least one fixation outside it. Reflects revisitation frequency and scanning strategy.',
  unit: 'count',
  category: 'counts',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  aoiAggregate: { max: 'most-visited AOI', min: 'least-visited AOI' },
  // Extensive: a raw count. Cohort `sum` and per-participant `mean` are both
  // sound across participants, and sum/mean are sound across matrix cells.
  measurementClass: 'extensive',
  searchTags: ['visit', 'entry', 'entries', 'count', 'aoi', 'number', 'transitions'],
  params: [] as const,
  accumulation: 'stateful',
  init: ({ slots }): Acc => ({
    entries: new Float64Array(slots.totalSlots),
    previousAois: new Set(),
    wasInNoAoi: false,
  }),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // KEEP IN SYNC with visitDuration's onFixation — the two co-define what a
    // VISIT is (previousAois / setsMatch / no-AOI run collapsing). They can't
    // share the state machine: it is per-fixation hot-loop code, and hoisting
    // it into an onEnter/onLeave callback is the shared-callback pattern that
    // measured ~15% slower and was reverted. Pinned instead, slot for slot, by
    // the "defines the SAME visits as visitCount" test in metricFormulas.test.ts
    // (unwindowed; under windowing the two deliberately diverge — this one
    // midpoint-gates, visitDuration is any-overlap).
    //
    // SW-RQA membership: a visit "belongs to" the window containing the
    // visit's defining fixation midpoint. Skip-and-don't-update-state for
    // fixations whose midpoint falls outside the active scope so per-window
    // visit counts compose to the unwindowed total. For unbounded scopes
    // `midpointInWindow` is always true, so non-windowed queries match the
    // existing behaviour.
    if (!frame.midpointInWindow) return
    if (slots.length === 0) {
      if (!acc.wasInNoAoi) {
        acc.entries[info.noAoiSlot]++
        acc.entries[info.anyFixationSlot]++
        acc.wasInNoAoi = true
      }
      acc.previousAois.clear()
      return
    }
    const setsMatch =
      slots.length === acc.previousAois.size &&
      slots.every(s => acc.previousAois.has(s))
    if (!setsMatch || acc.previousAois.size === 0) acc.entries[info.anyFixationSlot]++
    for (const s of slots) if (!acc.previousAois.has(s)) acc.entries[s]++
    acc.wasInNoAoi = false
    acc.previousAois.clear()
    for (const s of slots) acc.previousAois.add(s)
  },
  finalize: (acc) => Array.from(acc.entries),
})
