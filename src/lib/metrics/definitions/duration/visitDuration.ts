import { defineMetric } from '../../core/defineMetric'

interface Acc {
  dwells: number[][]
  previousAois: Set<number>
  activeDwells: Map<number, number>
  wasInNoAoi: boolean
  currentNoAoiDwell: number
  currentAnyFixationDwell: number
}

/**
 * `anyFixationSlot` holds one entry per RUN OF CONSTANT AOI SET; off-AOI runs
 * are runs like any other and count. So the any-fixation visits TILE the scan:
 * unbounded, their durations sum to absoluteTime's any-fixation value and their
 * count equals visitCount's (both pinned in metricFormulas.test.ts).
 *
 * Windowing uses any-overlap membership, not the SW-RQA midpoint rule the count
 * metrics use — a visit-level membership rule is not specified yet.
 */
defineMetric({
  id: 'visitDuration',
  label: 'Visit duration',
  description: 'Per AOI: visit duration (ms) collapsed per participant (mean unless a summary projection chooses otherwise), where a visit accumulates consecutive same-AOI fixations and ends when gaze leaves.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  // No `aoiAggregate`: would be a double reduction (see fixationDuration).
  measurementClass: 'intensive',
  searchTags: ['visit', 'dwell', 'duration', 'average', 'mean', 'median', 'aoi'],
  params: [] as const,
  accumulation: 'stateful',
  sampleSummary: true,
  init: ({ slots }): Acc => ({
    dwells: Array.from({ length: slots.totalSlots }, () => []),
    previousAois: new Set(),
    activeDwells: new Map(),
    wasInNoAoi: false,
    currentNoAoiDwell: 0,
    currentAnyFixationDwell: 0,
  }),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    // KEEP IN SYNC with visitCount's onFixation — the two co-define a VISIT
    // (see the note there for why it is duplicated, not shared).
    if (slots.length === 0) {
      if (!acc.wasInNoAoi) {
        // Leaving AOIs for off-AOI closes the open any-fixation visit: the set
        // changed, so the run ended. Overwriting here instead of flushing once
        // dropped every AOI run followed by an off-AOI fixation.
        if (acc.previousAois.size > 0) {
          acc.dwells[info.anyFixationSlot].push(acc.currentAnyFixationDwell)
        }
        acc.currentNoAoiDwell = duration
        acc.currentAnyFixationDwell = duration
        acc.wasInNoAoi = true
      } else {
        acc.currentNoAoiDwell += duration
        acc.currentAnyFixationDwell += duration
      }
      for (const [idx, d] of acc.activeDwells) acc.dwells[idx].push(d)
      acc.activeDwells.clear()
      acc.previousAois.clear()
      return
    }
    if (acc.wasInNoAoi) {
      acc.dwells[info.noAoiSlot].push(acc.currentNoAoiDwell)
      acc.dwells[info.anyFixationSlot].push(acc.currentAnyFixationDwell)
      acc.currentNoAoiDwell = 0
      acc.currentAnyFixationDwell = 0
      acc.wasInNoAoi = false
    }
    const setsMatch = slots.length === acc.previousAois.size && slots.every(s => acc.previousAois.has(s))
    if (acc.previousAois.size > 0 && !setsMatch) {
      // Closed by the AOI set CHANGING, not by having accumulated time — a run
      // of zero-duration fixations is still a run.
      acc.dwells[info.anyFixationSlot].push(acc.currentAnyFixationDwell)
      acc.currentAnyFixationDwell = duration
    } else if (acc.previousAois.size === 0) {
      acc.currentAnyFixationDwell = duration
    } else {
      acc.currentAnyFixationDwell += duration
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      acc.activeDwells.set(
        s,
        (acc.previousAois.has(s) ? (acc.activeDwells.get(s) ?? 0) : 0) + duration,
      )
    }
    for (const prev of acc.previousAois) {
      if (!slots.includes(prev)) {
        const d = acc.activeDwells.get(prev)
        if (d !== undefined) {
          acc.dwells[prev].push(d)
          acc.activeDwells.delete(prev)
        }
      }
    }
    acc.previousAois.clear()
    for (let i = 0; i < slots.length; i++) acc.previousAois.add(slots[i])
  },
  flush: (acc, slots) => {
    for (const [idx, d] of acc.activeDwells) acc.dwells[idx].push(d)
    if (acc.wasInNoAoi) acc.dwells[slots.noAoiSlot].push(acc.currentNoAoiDwell)
    // Whenever one is OPEN, not only when its dwell is > 0 — a zero-duration
    // visit is real, and anyFixation must summarise the same visits as the
    // per-AOI slots.
    if (acc.wasInNoAoi || acc.previousAois.size > 0)
      acc.dwells[slots.anyFixationSlot].push(acc.currentAnyFixationDwell)
    // Clearing keeps flush idempotent (its contract).
    acc.activeDwells.clear()
    acc.previousAois.clear()
    acc.wasInNoAoi = false
  },
  individuals: acc => acc.dwells,
})
