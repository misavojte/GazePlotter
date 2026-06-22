import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import type { MetricInstance } from '../instances'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Consumer-facing helpers for fixation-windowed metrics.
 *
 * Convention: any metric with `windowUnit: 'fixations'` accumulates into an
 * object with a `.seq: number[]` field (populated in `onFixation`). The helpers
 * below rely on that convention to let plots (e.g. evolving-metrics) compute
 * a metric's scalar over a pre-extracted sub-sequence without going through the
 * DSL's default windowing reduction.
 */

export interface FixationSequence {
  seq: number[]
  timestamps: number[]
  endTimestamps: number[]
}

/**
 * Extract the fixation sequence with segment timestamps for a participant.
 * Single-AOI fixations are always included. Multi-AOI fixations are always
 * skipped — there is no canonical sentinel for "simultaneously in several
 * AOIs". Zero-AOI (off-AOI) fixations are included only when `includeNoAoi`
 * is set, in which case they map to `slots.noAoiSlot` so the RQA equality
 * check treats two off-AOI fixations as recurrent.
 *
 * Must stay index-aligned with the metric recipe's `onFixation` filter:
 * callers that feed a recipe's accumulator (e.g. the evolving-metrics
 * transformer resolving window start indices back to ms) must pass the
 * same `includeNoAoi` value the recipe was instantiated with.
 */
export function extractFixationSequence(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  options?: { includeNoAoi?: boolean },
): FixationSequence {
  const slots = buildAoiSlots(engine, stimulusId)
  if (!slots) return { seq: [], timestamps: [], endTimestamps: [] }
  const { reader, hiddenAoisSet, aoiLookup, noAoiSlot } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const includeNoAoi = options?.includeNoAoi ?? false
  const seq: number[] = []
  const timestamps: number[] = []
  const endTimestamps: number[] = []
  const aoiSet = new Set<number>()
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== FIXATION_CATEGORY_ID) continue
    aoiSet.clear()
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      const rawId = rawAois[r]
      if (hiddenAoisSet?.has(rawId)) continue
      const slot = aoiLookup.get(engine.getAoiMapping(stimulusId, rawId))
      if (slot !== undefined) aoiSet.add(slot)
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

