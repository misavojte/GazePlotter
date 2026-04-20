import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { defineMetric } from './defineMetric'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { computeRqaFromSequence, type RqaResult } from './rqa'
import type { FixationEvent, Metric, MetricRecipe, OutputShape } from './dsl'
import type { ParamDef, ParamsOf } from './params'
import type { MetricInstance } from '../instances'

export interface SequenceRecipe<P extends readonly ParamDef<any>[]> {
  id: string
  label: string
  unit: string
  description: string
  category: string
  outputShape?: OutputShape
  params?: P
  searchTags?: readonly string[]
  computationModes?: ('global' | 'epoch' | 'sliding')[]
  groupAggregation?: 'mean' | 'median' | 'sum'
  defaultWindowing?: MetricRecipe<any, any>['defaultWindowing']
  defaultLabel?: (params: ParamsOf<P>) => string

  sequenceFilter?: 'singleAoi' | ((fix: FixationEvent) => number | null)
  minLineLength: (params: ParamsOf<P>) => number
  rqaSelector: (result: RqaResult) => number
  /** Returned when the RQA matrix has no recurrences (R=0). Defaults to NaN. */
  scalarOnNoRecurrence?: number
}

interface SeqAcc { seq: number[] }

const SEQ_KEY = Symbol.for('gazeplotter.metrics.sequenceRecipes')
const _sequenceRecipes: Map<string, SequenceRecipe<any>> =
  ((globalThis as Record<symbol, unknown>)[SEQ_KEY] as Map<string, SequenceRecipe<any>>) ??
  ((globalThis as Record<symbol, unknown>)[SEQ_KEY] = new Map())

export function defineSequenceMetric<const P extends readonly ParamDef<any>[]>(
  recipe: SequenceRecipe<P>,
): Metric {
  const filter = recipe.sequenceFilter ?? 'singleAoi'
  const outputShape = recipe.outputShape ?? 'scalar'
  _sequenceRecipes.set(recipe.id, recipe as SequenceRecipe<any>)

  return defineMetric({
    id: recipe.id,
    label: recipe.label,
    unit: recipe.unit,
    description: recipe.description,
    category: recipe.category,
    outputShape,
    windowUnit: 'fixations',
    params: recipe.params,
    searchTags: recipe.searchTags,
    computationModes: recipe.computationModes,
    groupAggregation: recipe.groupAggregation,
    defaultWindowing: recipe.defaultWindowing,
    defaultLabel: recipe.defaultLabel,
    init: (): SeqAcc => ({ seq: [] }),
    onFixation: (acc, fix) => {
      const slot = filter === 'singleAoi'
        ? (fix.slots.length === 1 ? fix.slots[0] : null)
        : filter(fix)
      if (slot !== null && slot !== undefined) acc.seq.push(slot)
    },
    finalize: (acc, _slots, ctx) =>
      [applyRqa(acc.seq, 0, acc.seq.length, recipe, ctx.params as ParamsOf<P>)],
    windowedFinalize: (acc, from, to, ctx) =>
      applyRqa(acc.seq, from, to, recipe, ctx.params as ParamsOf<P>),
  })
}

function applyRqa<P extends readonly ParamDef<any>[]>(
  fullSeq: readonly number[],
  from: number,
  to: number,
  recipe: SequenceRecipe<P>,
  params: ParamsOf<P>,
): number {
  const sub = from === 0 && to === fullSeq.length ? fullSeq : fullSeq.slice(from, to)
  const result = computeRqaFromSequence(sub, recipe.minLineLength(params))
  if (!result) return Number.NaN
  if (result.R === 0) return recipe.scalarOnNoRecurrence ?? Number.NaN
  return recipe.rqaSelector(result)
}

// ─── Public helpers for consumers that need the raw sequence ────────────────

export interface FixationSequence {
  seq: number[]
  timestamps: number[]
}

/**
 * Extract the single-AOI fixation sequence with segment timestamps for a participant.
 * Used by consumers (e.g. evolving-metrics plot) that align fixation-windowed RQA
 * results to a time grid.
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
 * Compute a sequence metric's scalar on a pre-extracted sub-sequence. Uses the
 * recipe's own `rqaSelector` + `minLineLength` — no dispatching on baseId.
 * Returns NaN if the metric isn't a sequence metric.
 */
export function computeSequenceScalar(
  instance: MetricInstance,
  subSeq: readonly number[],
): number {
  const recipe = _sequenceRecipes.get(instance.baseId)
  if (!recipe) return Number.NaN
  const params = resolveParams(recipe.params, instance.params) as ParamsOf<any>
  return applyRqa(subSeq, 0, subSeq.length, recipe, params)
}

export function isSequenceMetric(metricId: string): boolean {
  return _sequenceRecipes.has(metricId)
}
