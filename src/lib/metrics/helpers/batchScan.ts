import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { getMetricDef } from '../defineMetric'
import { buildAoiSlots } from './aoiSlots'
import type { MetricInstance, SegmentScanner } from '../types'

/**
 * Scan segments ONCE for a participant and compute all provided metric instances.
 * Returns a map of instanceId → per-slot result array.
 * Only instances whose baseId has `createScanner` are included; others are omitted.
 */
export function batchScanMetrics(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  timeStart: number,
  timeEnd: number,
  instances: MetricInstance[]
): Map<number, number[]> {
  const aois = getAois(engine, stimulusId)
  const slots = buildAoiSlots(engine, stimulusId, aois)
  if (!slots) return new Map()

  const { reader, totalSlots, noAoiSlot, anyFixationSlot, hiddenAoisSet, aoiLookup } = slots

  const active: Array<{ inst: MetricInstance; scanner: SegmentScanner }> = []
  for (const inst of instances) {
    const scanner = getMetricDef(inst.baseId)?.createScanner?.(totalSlots, noAoiSlot, anyFixationSlot, inst)
    if (scanner) active.push({ inst, scanner })
  }
  if (active.length === 0) return new Map()

  const resolvedSlots: number[] = []
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)

  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    resolvedSlots.length = 0
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const s = aoiLookup.get(engine.getAoiMapping(stimulusId, rawAois[r]))
      if (s !== undefined) resolvedSlots.push(s)
    }

    for (let a = 0; a < active.length; a++) {
      active[a].scanner.push(start, end - start, resolvedSlots)
    }
  }

  const out = new Map<number, number[]>()
  for (let a = 0; a < active.length; a++) {
    out.set(active[a].inst.id, active[a].scanner.finalize())
  }
  return out
}
