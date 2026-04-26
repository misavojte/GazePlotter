import { defineMetric } from '../../core/defineMetric'

/**
 * ## First fixation duration
 *
 * Duration (ms) of the very first fixation on each AOI. Reflects initial
 * processing depth upon first encounter with the region.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `ttf` (first-fixation family)
 * - **Windowing:** forbidden — "first" is a stimulus-lifetime concept;
 *   a rolling window would redefine "first" per window, which is not what
 *   the scientific literature means by this metric.
 *
 * ### Parameters
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'firstFixationDuration', baseId: 'firstFixationDuration', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'First fixation duration' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - AOIs never fixated return `NaN` (represented as `-1` in the accumulator,
 *   mapped to `NaN` in `finalize`).
 * - `supportsWindowing: false` — the validator rejects any windowed projection.
 */
defineMetric({
  id: 'firstFixationDuration',
  label: 'First fixation duration',
  description: 'Per AOI: duration (ms) of the first fixation that landed inside it. Reflects initial processing depth on first encounter. NaN if the AOI was never fixated.',
  unit: 'ms',
  category: 'ttf',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  supportsWindowing: false,
  providesAnyFixation: true,
  searchTags: ['first', 'fixation', 'duration', 'ttf', 'aoi'],
  params: [] as const,
  init: ({ slots }) => new Array<number>(slots.totalSlots).fill(-1),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    if (acc[info.anyFixationSlot] === -1) acc[info.anyFixationSlot] = duration
    if (slots.length === 0) {
      if (acc[info.noAoiSlot] === -1) acc[info.noAoiSlot] = duration
      return
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (acc[s] === -1) acc[s] = duration
    }
  },
  finalize: (acc) => acc.map(v => v === -1 ? Number.NaN : v),
})
