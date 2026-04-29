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
 * ### Usage
 * ```ts
 * query(
 *   { id: 'visitCount', baseId: 'visitCount', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Visit count' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Increments slot `s` only if `s` was NOT in the previous fixation's slot
 *   set; a visit is a transition from absent → present.
 * - `anyFixationSlot` increments on any set-of-slots change (including when
 *   the set becomes empty), so it captures "number of distinct
 *   attended-to-something intervals".
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
  searchTags: ['visit', 'entry', 'entries', 'count', 'aoi', 'number', 'transitions'],
  params: [] as const,
  init: ({ slots }): Acc => ({
    entries: new Float64Array(slots.totalSlots),
    previousAois: new Set(),
    wasInNoAoi: false,
  }),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
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
