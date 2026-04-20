import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getParticipantsIds } from '$lib/data/engine'
import { getMetric, queryBatch, type MetricInstance, type Scope } from '$lib/metrics'
import type {
  CorrelationCell,
  CorrelationPoint,
  MetricCorrelationResult,
  MetricCorrelationSettings,
  MetricDescriptor,
  MetricVector,
} from '../types'
import { correlate } from './correlations'

interface BuildOptions {
  /** Whether to populate paired-sample points for SPLOM rendering. */
  includePoints: boolean
}

/**
 * Correlates scalar-valued metric instances across participants. The context
 * filter already ensures every selected instance has projection.target =
 * 'scalar' — any AOI binding is baked into the instance's projection, not the
 * plot — so the transformer has no plot-level scope to resolve.
 */
export function getMetricCorrelationData(
  engine: DataEngine,
  settings: MetricCorrelationSettings,
  options: BuildOptions = { includePoints: false }
): MetricCorrelationResult {
  const meta = engine.metadata
  if (!meta) return emptyResult(settings)

  const participantIds = getParticipantsIds(engine, settings.groupId, settings.stimulusId)

  const { metrics, instances } = resolveMetrics(
    settings.enabledMetricIds,
    meta.metricInstances
  )
  if (metrics.length < 2 || participantIds.length === 0) return emptyResult(settings)

  const participantLabels = participantIds.map(id => {
    const pData = meta.participants.data[id]
    return pData?.[1] ?? pData?.[0] ?? `P${id}`
  })

  const vectors: MetricVector[] = metrics.map(m => ({
    metricId: m.id,
    values: new Array<number>(participantIds.length),
  }))

  for (let p = 0; p < participantIds.length; p++) {
    const pid = participantIds[p]
    const pScope: Scope = {
      engine,
      stimulusId: settings.stimulusId,
      participantId: pid,
      timeStart: settings.timelineStart ?? 0,
      timeEnd: settings.timelineEnd ?? 0,
    }
    const results = queryBatch(instances, pScope)
    for (let mIdx = 0; mIdx < metrics.length; mIdx++) {
      const result = results.get(instances[mIdx].id)
      vectors[mIdx].values[p] = result?.shape === 'scalar' ? result.value : Number.NaN
    }
  }

  const cells = computeCells(
    metrics,
    vectors,
    settings.correlationMethod,
    options.includePoints,
    participantLabels
  )

  return {
    metrics,
    vectors,
    cells,
    correlationMethod: settings.correlationMethod,
    sampleSize: participantIds.length,
    participantLabels,
  }
}

function resolveMetrics(
  enabledIds: number[],
  workspaceInstances: readonly MetricInstance[] | undefined
): { metrics: MetricDescriptor[]; instances: MetricInstance[] } {
  const library: readonly MetricInstance[] = workspaceInstances ?? []

  const selected: MetricInstance[] = enabledIds
    .map(id => library.find(i => i.id === id))
    .filter((i): i is MetricInstance => !!i)

  const metrics: MetricDescriptor[] = []
  const instances: MetricInstance[] = []
  for (const inst of selected) {
    const metric = getMetric(inst.baseId)
    if (!metric) continue
    metrics.push({ id: String(inst.id), label: inst.label, unit: metric.meta.unit })
    instances.push(inst)
  }
  return { metrics, instances }
}

function computeCells(
  metrics: MetricDescriptor[],
  vectors: MetricVector[],
  method: MetricCorrelationSettings['correlationMethod'],
  includePoints: boolean,
  participantLabels: string[]
): CorrelationCell[] {
  const cells: CorrelationCell[] = []
  for (let row = 0; row < metrics.length; row++) {
    for (let col = 0; col < metrics.length; col++) {
      const rowVec = vectors[row].values
      const colVec = vectors[col].values
      const { r, n } = correlate(colVec, rowVec, method)

      let points: CorrelationPoint[] | undefined
      if (includePoints && row !== col) {
        points = []
        for (let i = 0; i < rowVec.length; i++) {
          const x = colVec[i]
          const y = rowVec[i]
          if (Number.isNaN(x) || Number.isNaN(y)) continue
          points.push({ x, y, participantLabel: participantLabels[i] })
        }
      }

      cells.push({
        rowMetricId: metrics[row].id,
        colMetricId: metrics[col].id,
        r,
        n,
        points,
      })
    }
  }
  return cells
}

function emptyResult(settings: MetricCorrelationSettings): MetricCorrelationResult {
  return {
    metrics: [],
    vectors: [],
    cells: [],
    correlationMethod: settings.correlationMethod,
    sampleSize: 0,
  }
}
