import './init'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'

export type {
  MetricDef,
  MetricParamDef,
  MetricParamType,
  MetricCategory,
  MetricComputationMode,
  MetricInstance,
  MetricOutputShape,
  WindowingConfig,
} from './types'

// Registry
export {
  METRIC_DEFS,
  getMetricDef,
  getMetricDefs,
  METRIC_CATEGORY_ORDER,
  METRIC_CATEGORY_LABELS,
  getCategoryOrder,
  getCategoryLabels,
  getAllCategories,
  getCategory,
} from './registry'

// Extension API
export { defineMetric } from './defineMetric'
export { defineCategory } from './categories'
export type { MetricCategoryDef } from './categories'

// Instances
export {
  createSystemMetricInstances,
  findSystemInstanceIdByBaseId,
  reconcileSystemInstances,
  createDefaultWindowedInstances,
  createDefaultMetricInstances,
  nextInstanceId,
  resolveInstance,
  defaultInstanceLabel,
  formatParamReadout,
  formatWindowingReadout,
} from './instances'

// Computation
import type { MetricComputeContext, MetricInstance, MetricOutputShape, WindowingConfig } from './types'
import { getMetricDef } from './defineMetric'

export type { MetricComputeContext }
/** @deprecated Use MetricComputeContext */
export type MetricQueryContext = MetricComputeContext

export type MetricGroupBy = 'aoi' | 'aoi-pair' | 'scalar'

export function queryMetric(
  engine: DataEngine,
  instance: MetricInstance,
  ctx: MetricComputeContext,
  aoiIndex = 0,
): number {
  return getMetricDef(instance.baseId)?.compute(engine, ctx, instance)[aoiIndex] ?? Number.NaN
}

export function computeParticipantScalar(
  engine: DataEngine,
  instance: MetricInstance,
  ctx: MetricComputeContext,
  aoiIndex = 0,
): number {
  return getMetricDef(instance.baseId)?.compute(engine, ctx, instance)[aoiIndex] ?? Number.NaN
}

export function queryMetricGrouped(
  engine: DataEngine,
  instance: MetricInstance,
  ctx: MetricComputeContext,
  groupBy: MetricGroupBy,
): number[] {
  const def = getMetricDef(instance.baseId)
  if (!def) return []
  if (
    (groupBy === 'aoi' && def.outputShape !== 'aoi-vector') ||
    (groupBy === 'aoi-pair' && def.outputShape !== 'aoi-pair-matrix') ||
    (groupBy === 'scalar' && def.outputShape !== 'scalar')
  ) {
    console.warn(`queryMetricGrouped: groupBy '${groupBy}' does not match metric outputShape '${def.outputShape}'`)
  }
  return def.compute(engine, ctx, instance)
}

function _reduceSlotWise(
  perParticipant: number[][],
  method: 'mean' | 'median' | 'sum',
): number[] {
  if (perParticipant.length === 0) return []
  const slotCount = perParticipant[0].length
  const result = new Array<number>(slotCount)
  for (let s = 0; s < slotCount; s++) {
    const vals = perParticipant.map(p => p[s]).filter(v => Number.isFinite(v))
    if (vals.length === 0) { result[s] = Number.NaN; continue }
    if (method === 'sum') {
      result[s] = vals.reduce((a, b) => a + b, 0)
    } else if (method === 'mean') {
      result[s] = vals.reduce((a, b) => a + b, 0) / vals.length
    } else {
      const sorted = [...vals].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      result[s] = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
  }
  return result
}

export function queryMetricForGroup(
  engine: DataEngine,
  instance: MetricInstance,
  ctx: Omit<MetricComputeContext, 'participantId'>,
  participantIds: number[],
): number[] {
  const def = getMetricDef(instance.baseId)
  if (!def || participantIds.length === 0) return []
  const perParticipant = participantIds.map(pId =>
    def.compute(engine, { ...ctx, participantId: pId }, instance)
  )
  return _reduceSlotWise(perParticipant, def.groupAggregation ?? 'mean')
}

export interface MetricFlatResult {
  value: number
  unit: string
  baseId: string
  outputShape: MetricOutputShape
  isValid: boolean
  error?: string
}

export function queryMetricFlat(
  engine: DataEngine,
  baseId: string,
  params: Record<string, unknown>,
  stimulusId: number,
  participantId: number,
  aoiSlot = 0,
  timeStart = 0,
  timeEnd = 0,
  windowing?: WindowingConfig,
  groupBy: MetricGroupBy = 'aoi',
): MetricFlatResult {
  const def = getMetricDef(baseId)
  if (!def) return { value: Number.NaN, unit: '', baseId, outputShape: 'aoi-vector', isValid: false, error: `Unknown metric: ${baseId}` }
  if (groupBy === 'aoi-pair') return { value: Number.NaN, unit: def.unit, baseId, outputShape: def.outputShape, isValid: false, error: 'Use queryMetricGrouped for aoi-pair metrics' }
  const inst: MetricInstance = { id: 0, baseId, params, label: '', windowing }
  const ctx: MetricComputeContext = { stimulusId, participantId, timeStart, timeEnd }
  const result = def.compute(engine, ctx, inst)
  const value = result[aoiSlot] ?? Number.NaN
  return { value, unit: def.unit, baseId, outputShape: def.outputShape, isValid: Number.isFinite(value) }
}

export { computeRqaAoiScalar } from './rqaAoiCompute'

// Components
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
