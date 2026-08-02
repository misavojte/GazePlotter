import { defineMetric } from '../../core/defineMetric'

interface Acc {
  entries: Float64Array
  previousAois: Set<number>
  wasInNoAoi: boolean
}

/**
 * `anyFixationSlot` counts RUNS OF CONSTANT AOI SET — including runs where the
 * set is empty, so off-AOI runs count like any other. Same convention as
 * visitDuration's any-fixation slot (pinned equal in metricFormulas.test.ts).
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
    // KEEP IN SYNC with visitDuration's onFixation — the two co-define a VISIT
    // (previousAois / setsMatch / no-AOI run collapsing). Not shared: hoisting
    // this hot-loop state machine into an onEnter/onLeave callback measured
    // ~15% slower and was reverted. Pinned slot-for-slot in
    // metricFormulas.test.ts (unwindowed only — windowed, this midpoint-gates
    // while visitDuration is any-overlap).
    //
    // Skip without updating state, so per-window counts sum to the total.
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
