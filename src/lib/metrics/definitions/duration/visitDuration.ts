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
 * ## Visit duration (mean dwell per visit)
 *
 * Mean duration (ms) of a distinct visit to each AOI. A visit begins on first
 * entry and ends when gaze leaves; consecutive fixations in the same AOI
 * accumulate as a single visit.
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
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'visitDuration', baseId: 'visitDuration', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Visit duration' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Tracks overlapping visits via `activeDwells: Map<slot, accumulated-ms>`;
 *   a fixation that drops an AOI from its slot set closes the visit for that
 *   slot and pushes the accumulated duration into `dwells[slot]`.
 * - `anyFixationSlot` closes a visit whenever the overall AOI set changes
 *   (including transitions through off-AOI), so it captures "contiguous
 *   attended-to-something" intervals rather than raw fixation runs.
 * - `finalize` flushes still-open visits at scan end so trailing visits
 *   are not lost.
 */
defineMetric({
  id: 'visitDuration',
  label: 'Visit duration',
  description: 'Per AOI: mean visit duration (ms), where a visit accumulates consecutive same-AOI fixations and ends when gaze leaves.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  searchTags: ['visit', 'dwell', 'duration', 'average', 'mean', 'aoi'],
  params: [] as const,
  init: ({ slots }): Acc => ({
    dwells: Array.from({ length: slots.totalSlots }, () => []),
    previousAois: new Set(),
    activeDwells: new Map(),
    wasInNoAoi: false,
    currentNoAoiDwell: 0,
    currentAnyFixationDwell: 0,
  }),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    if (slots.length === 0) {
      if (!acc.wasInNoAoi) {
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
      if (acc.currentAnyFixationDwell > 0) acc.dwells[info.anyFixationSlot].push(acc.currentAnyFixationDwell)
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
  finalize: (acc, slots) => {
    for (const [idx, d] of acc.activeDwells) acc.dwells[idx].push(d)
    if (acc.wasInNoAoi) acc.dwells[slots.noAoiSlot].push(acc.currentNoAoiDwell)
    // Flush the trailing any-fixation visit whenever one is OPEN (mirroring the
    // per-AOI/no-AOI flushes above), not only when its dwell is > 0 — a visit
    // built solely from zero-duration fixations is real and must still count,
    // so anyFixation summarises the same visits as the per-AOI slots.
    if (acc.wasInNoAoi || acc.previousAois.size > 0)
      acc.dwells[slots.anyFixationSlot].push(acc.currentAnyFixationDwell)
    return acc.dwells.map(arr => {
      if (arr.length === 0) return Number.NaN
      let sum = 0
      for (const d of arr) sum += d
      return sum / arr.length
    })
  },
  individuals: (acc, slotIndex) => acc.dwells[slotIndex] ?? [],
})
