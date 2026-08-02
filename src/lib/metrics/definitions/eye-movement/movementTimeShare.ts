import { defineMetric } from '../../core/defineMetric'
import { percentShare } from '../../core/numeric'

/**
 * ## Eye-movement time share
 *
 * Share (%) of the recording spent in segments of EACH eye-movement type —
 * one value per type on the canonical displayed-name axis. The denominator is
 * the scan's effective extent (`ctx.scopeDurationMs`): the participant's
 * recording length, the bounded time range when one is set, or the window
 * size under windowing — so per-window shares are honest shares of that
 * window. Extract a single type via the `pick-category` projection.
 *
 * - **Shape:** `category-vector`
 * - **Unit:** `%`
 * - **Category:** `eye-movement`
 * - **Windowing:** supported (in-window overlap over the window size)
 *
 * ### Parameters
 * None.
 *
 * ### Invariants
 * - NaN when the scan has no extent (participant without segments) — never a
 *   share of nothing.
 * - 0 for types the recording contains no segments of (same caveat as
 *   `movementCount`: fixation-only sources cannot record them).
 */
defineMetric({
  id: 'movementTimeShare',
  label: 'Eye-movement time share',
  description: 'Per eye-movement type: share (%) of the recording (or the bounded range / window) spent in segments of that type. 0 for types the recording contains no segments of.',
  unit: '%',
  category: 'eye-movement',
  rawShape: 'category-vector',
  windowUnit: 'ms',
  // Proportion: a [0,100] share — mean is the sound cross-participant
  // reduction, and distribution plots render it as a plain proportional bar
  // (mirrors `fixated`).
  measurementClass: 'proportion',
  searchTags: ['saccade', 'blink', 'share', 'proportion', 'percentage', 'time', 'eye movement', 'type'],
  params: [] as const,
  scanSource: 'categories',
  accumulation: 'stateful',
  init: ({ categorySlotCount }) => new Float64Array(categorySlotCount),
  onFixation: (acc, { frame, categorySlot }) => {
    // In-window overlap so windowed shares compose against the window size;
    // across an unbounded scope it equals the segment's own duration.
    if (categorySlot < 0) return
    acc[categorySlot] += frame.duration
  },
  finalize: (acc, _slots, { scopeDurationMs }) => percentShare(acc, scopeDurationMs),
})
