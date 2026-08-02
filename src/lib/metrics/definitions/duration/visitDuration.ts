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
 * ## Visit duration
 *
 * A summary of the durations (ms) of distinct visits to each AOI, one value per
 * AOI, collapsed per participant by `ctx.summaryStatistic`. A visit begins on
 * first entry and ends when gaze leaves; consecutive fixations in the same AOI
 * accumulate as a single visit.
 *
 * The recipe carries NO summary param, deliberately (`sampleSummary`) — see
 * `fixationDuration` for the full reasoning; the two duration metrics declare
 * the summary identically.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `duration`
 * - **Windowing:** supported (status quo: any-overlap membership). The
 *   scientifically-correct rule for windowed visits — "a visit belongs to
 *   the window containing the visit's midpoint timestamp" — is **deferred**
 *   until the project specifies the visit-level membership semantics.
 *   Today, with windowing, a visit that crosses a window boundary
 *   contributes its accumulated duration to every overlapping window's
 *   mean. This will change once the visit-membership rule is specified;
 *   `fixationCount` / `visitCount` already use the SW-RQA midpoint rule.
 *   See `WindowFrame` in `core/dsl.ts` for the available signals.
 *
 * ### Parameters
 * None (see `sampleSummary` above).
 *
 * ### Invariants
 * - Tracks overlapping visits via `activeDwells: Map<slot, accumulated-ms>`;
 *   a fixation that drops an AOI from its slot set closes the visit for that
 *   slot and pushes the accumulated duration into `dwells[slot]`.
 * - `anyFixationSlot` holds one entry per RUN OF CONSTANT AOI SET, closing a
 *   visit whenever that set changes. Off-AOI runs (the empty set) are runs
 *   like any other and are INCLUDED, matching what `anyFixation` means on
 *   every other metric: all fixations, AOIs ignored. Consequence and
 *   invariant: the any-fixation visits TILE the scan, so on an unbounded
 *   scope their durations sum to the total fixation time (`absoluteTime`'s
 *   any-fixation value) and their count equals `visitCount`'s. Both are
 *   pinned in metricFormulas.test.ts. Filtering off-AOI runs out here would
 *   make this the one whole-stimulus slot that silently drops data; analysts
 *   wanting AOI-only episodes read the per-AOI slots.
 * - `flush` closes still-open visits at scan end so trailing visits are not
 *   lost, and runs before BOTH readers of the sample (the derived summary and
 *   the beeswarm's dots) so the two never see different visits.
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
  // No `aoiAggregate`: the summary `statistic` already reduces within each
  // AOI — an extreme across AOIs would be a double reduction (see
  // fixationDuration).
  // Intensive: a per-participant central value of visit durations. Every offered
  // statistic (mean/median/max/min) stays intensive — only `mean` is sound
  // across participants (for a cohort total of dwell use absoluteTime).
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
    // KEEP IN SYNC with visitCount's onFixation — the two co-define what a
    // VISIT is; see the note there for why the state machine is duplicated
    // rather than shared, and metricFormulas.test.ts for the equivalence pin.
    if (slots.length === 0) {
      if (!acc.wasInNoAoi) {
        // Leaving AOIs for off-AOI CLOSES the open any-fixation visit: the AOI
        // set changed, so the run ended. Mirrors the flush below when a no-AOI
        // run ends. (This used to overwrite instead of flushing, which dropped
        // every AOI run that was followed by an off-AOI fixation and left the
        // whole-stimulus sample holding only off-AOI runs.)
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
      // A visit is closed by the AOI set CHANGING, not by having accumulated
      // time: a run of zero-duration fixations is still a run (same rule
      // finalize applies to the trailing visit).
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
    // Flush the trailing any-fixation visit whenever one is OPEN (mirroring the
    // per-AOI/no-AOI flushes above), not only when its dwell is > 0 — a visit
    // built solely from zero-duration fixations is real and must still count,
    // so anyFixation summarises the same visits as the per-AOI slots.
    if (acc.wasInNoAoi || acc.previousAois.size > 0)
      acc.dwells[slots.anyFixationSlot].push(acc.currentAnyFixationDwell)
    // Idempotent (the `flush` contract): with every open visit now closed, a
    // second call has nothing left to push.
    acc.activeDwells.clear()
    acc.previousAois.clear()
    acc.wasInNoAoi = false
  },
  individuals: acc => acc.dwells,
})
