import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import type { MetricInstance } from '../instances'

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
}

/**
 * Extract the single-AOI fixation sequence with segment timestamps for a
 * participant. Fixations that resolve to zero AOIs or multiple AOIs are
 * skipped — RQA-style metrics operate on unambiguous categorical streams.
 */
export function extractFixationSequence(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
): FixationSequence {
  const slots = buildAoiSlots(engine, stimulusId)
  if (!slots) return { seq: [], timestamps: [] }
  const { reader, hiddenAoisSet, aoiLookup } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const seq: number[] = []
  const timestamps: number[] = []
  const aoiSet = new Set<number>()
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
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
    }
  }
  return { seq, timestamps }
}

/**
 * Evaluate a fixation-windowed metric on a pre-extracted sub-sequence. The
 * instance's recipe must expose a `windowedFinalize` hook (all metrics with
 * `windowUnit: 'fixations'` do). The synthetic accumulator only needs a `.seq`
 * — recipes accumulating additional state on whole-participant scans should
 * still produce a correct scalar from just the sequence, since that's the only
 * input available to the plot here.
 */
export function computeSequenceScalar(
  instance: MetricInstance,
  subSeq: readonly number[],
): number {
  const recipe = getRecipe(instance.baseId)
  if (!recipe || !recipe.windowedFinalize) return Number.NaN
  const params = resolveParams(recipe.params, instance.params)
  const acc: { seq: number[] } = { seq: [...subSeq] }
  const slots = { totalSlots: 0, noAoiSlot: 0, anyFixationSlot: 0 }
  return recipe.windowedFinalize(acc, 0, subSeq.length, { params, slots })
}
