import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { buildAoiSlots } from './aoiSlots'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Consumer-facing helpers for fixation-windowed metrics, which by convention
 * all accumulate into a `.seq: number[]`. They let a plot compute a metric's
 * scalar over a pre-extracted sub-sequence, bypassing the DSL's windowing.
 */

export interface FixationSequence {
  seq: number[]
  timestamps: number[]
  endTimestamps: number[]
}

/**
 * Single-AOI fixations always count. Multi-AOI ones are always skipped — there
 * is no canonical sentinel for "in several AOIs at once". Off-AOI ones count
 * only under `includeNoAoi`, mapping to `slots.noAoiSlot` so the RQA equality
 * check treats two of them as recurrent.
 *
 * ONE of three deliberately different multi-AOI policies for "the AOI
 * sequence" — the scanpath encoder keeps the first visible AOI, and the
 * recurrence PLOT keeps all AOIs with shares-any-AOI recurrence. Different
 * scientific questions; do not unify them.
 *
 * Callers feeding a recipe's accumulator must pass the same `includeNoAoi`,
 * `aoiSelectionId` and time range the recipe was queried with, or the indices
 * stop aligning. Pinned by `tests/fixationSequenceAlignment.test.ts`.
 */
export function extractFixationSequence(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  options?: {
    includeNoAoi?: boolean
    aoiSelectionId?: number
    /** Same half-open clip `scanAccumulator` applies; `timeEnd` 0 = unbounded. */
    timeStart?: number
    timeEnd?: number
  },
): FixationSequence {
  const slots = buildAoiSlots(engine, stimulusId, options?.aoiSelectionId)
  if (!slots) return { seq: [], timestamps: [], endTimestamps: [] }
  const { reader, rawToSlot, noAoiSlot } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const includeNoAoi = options?.includeNoAoi ?? false
  const timeStart = options?.timeStart ?? 0
  const timeEnd = options?.timeEnd ?? 0
  const seq: number[] = []
  const timestamps: number[] = []
  const endTimestamps: number[] = []
  const aoiSet = new Set<number>()
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== FIXATION_CATEGORY_ID) continue
    if (timeEnd > 0 && reader.getSegmentStart(i) >= timeEnd) break
    if (reader.getSegmentEnd(i) <= timeStart) continue
    aoiSet.clear()
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      // Same cached table the scans resolve through, so this function cannot
      // drift from them on the resolution half; the alignment test then only
      // has to hold the POLICY half (which fixations are kept).
      const slot = rawToSlot[rawAois[r]]
      if (slot >= 0) aoiSet.add(slot)
    }
    if (aoiSet.size === 1) {
      seq.push(aoiSet.values().next().value!)
      timestamps.push(reader.getSegmentStart(i))
      endTimestamps.push(reader.getSegmentEnd(i))
    } else if (includeNoAoi && aoiSet.size === 0) {
      seq.push(noAoiSlot)
      timestamps.push(reader.getSegmentStart(i))
      endTimestamps.push(reader.getSegmentEnd(i))
    }
  }
  return { seq, timestamps, endTimestamps }
}

