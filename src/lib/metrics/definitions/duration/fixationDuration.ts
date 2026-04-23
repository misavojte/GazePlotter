import { defineMetric } from '../../core/defineMetric'

interface Acc { durations: number[][] }

/**
 * ## Fixation duration (mean)
 *
 * Mean duration (ms) of individual fixations on each AOI. Longer fixations
 * typically indicate deeper cognitive processing of the region.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `ms`
 * - **Category:** `duration`
 * - **Windowing:** supported
 *
 * ### Parameters
 * None.
 *
 * ### Usage
 * ```ts
 * query(
 *   { id: 'fixationDuration', baseId: 'fixationDuration', params: {},
 *     projection: { kind: 'identity-aoi-vector' }, label: 'Fixation duration' },
 *   { engine, stimulusId, participantId },
 * )
 * ```
 *
 * ### Invariants
 * - Accumulates per-slot duration arrays so `individuals(slotIndex)` can
 *   return every fixation duration that contributed to the mean — used by
 *   bar-plot box overlays.
 * - Slots with no fixations return `NaN` (not `0`) so they drop from
 *   downstream reduces rather than dragging the mean to zero.
 */
defineMetric({
  id: 'fixationDuration',
  label: 'Fixation duration',
  description: 'Mean duration (ms) of individual fixations on the AOI. Longer fixations typically indicate deeper cognitive processing.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  searchTags: ['fixation', 'duration', 'average', 'mean', 'fix', 'aoi'],
  params: [] as const,
  init: ({ slots }): Acc => ({ durations: Array.from({ length: slots.totalSlots }, () => []) }),
  onFixation: (acc, { duration, slots }, { slots: info }) => {
    acc.durations[info.anyFixationSlot].push(duration)
    if (slots.length === 0) { acc.durations[info.noAoiSlot].push(duration); return }
    for (let i = 0; i < slots.length; i++) acc.durations[slots[i]].push(duration)
  },
  finalize: (acc) => acc.durations.map(arr => {
    if (arr.length === 0) return Number.NaN
    let sum = 0
    for (const d of arr) sum += d
    return sum / arr.length
  }),
  individuals: (acc, slotIndex) => acc.durations[slotIndex] ?? [],
})
