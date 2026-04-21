import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import type { MetricInstance } from '../instances'

/**
 * Iterate a participant's fixation segments exactly once and fan results out to
 * every instance. Returns a Map<instanceId, number[]> matching each recipe's
 * `finalize` output shape. Windowed instances are skipped — their per-window
 * scan requires `runProjected()` in runtime.ts.
 */
export function scanBatch(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  instances: readonly MetricInstance[],
  timeStart: number = 0,
  timeEnd: number = 0,
): Map<string, number[]> {
  const slots = buildAoiSlots(engine, stimulusId)
  if (!slots) return new Map()

  type Active = {
    inst: MetricInstance
    recipe: ReturnType<typeof getRecipe>
    acc: any
    ctx: { params: Record<string, unknown>; slots: typeof slots }
  }

  const active: Active[] = []
  for (const inst of instances) {
    if (inst.projection.kind === 'windowed') continue
    const recipe = getRecipe(inst.baseId)
    if (!recipe) continue
    const params = resolveParams(recipe.params, inst.params)
    const ctx = { params, slots }
    active.push({ inst, recipe, acc: recipe.init(ctx), ctx })
  }
  if (active.length === 0) return new Map()

  const { reader, hiddenAoisSet, aoiLookup } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const resolvedSlots: number[] = []
  let index = 0

  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    resolvedSlots.length = 0
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      const rawId = rawAois[r]
      if (hiddenAoisSet?.has(rawId)) continue
      const slot = aoiLookup.get(engine.getAoiMapping(stimulusId, rawId))
      if (slot !== undefined) resolvedSlots.push(slot)
    }

    const fix = { start, duration: end - start, slots: resolvedSlots, index }
    for (const a of active) a.recipe!.onFixation(a.acc, fix, a.ctx)
    index++
  }

  const out = new Map<string, number[]>()
  for (const a of active) {
    out.set(a.inst.id, a.recipe!.finalize(a.acc, slots, a.ctx))
  }
  return out
}
