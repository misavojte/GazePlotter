import { defineMetric } from '../../core/defineMetric'

/**
 * ## Time to first fixation
 *
 * Elapsed time (ms) from stimulus onset until the first fixation on each AOI.
 * Lower values mean the region captured attention earlier.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `ttf`
 * - **Windowing:** forbidden — "first" is a stimulus-lifetime concept; a
 *   rolling window would redefine "first" per window.
 *
 * ### Parameters
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'timeToFirstFixation', baseId: 'timeToFirstFixation', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Time to first fixation' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - AOIs never fixated return `NaN` (represented as `-1` in the accumulator,
 *   mapped to `NaN` in `finalize`). Callers that prefer a sentinel numeric
 *   value convert downstream (e.g. CSV export uses `-1`).
 * - `supportsWindowing: false` — the validator rejects any windowed projection.
 */
defineMetric({
  id: 'timeToFirstFixation',
  label: 'Time to first fixation',
  description: 'Per AOI: elapsed time (ms) from stimulus onset to the first fixation that landed in the AOI. Lower values mean the AOI captured attention earlier. NaN if never fixated.',
  unit: 'ms',
  category: 'ttf',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  supportsWindowing: false,
  providesAnyFixation: true,
  searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Array<number>(slots.totalSlots).fill(-1),
  onFixation: (acc, { start, slots }, { slots: info }) => {
    if (acc[info.anyFixationSlot] === -1) acc[info.anyFixationSlot] = start
    if (slots.length === 0) {
      if (acc[info.noAoiSlot] === -1) acc[info.noAoiSlot] = start
      return
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (acc[s] === -1) acc[s] = start
    }
  },
  finalize: (acc) => acc.map(v => v === -1 ? Number.NaN : v),
})
