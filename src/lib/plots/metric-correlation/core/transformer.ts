import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import { WHOLE_STIMULUS_AOI_LABEL } from '../const'
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

export function getMetricCorrelationData(
  engine: DataEngine,
  settings: MetricCorrelationSettings,
  options: BuildOptions = { includePoints: false }
): MetricCorrelationResult {
  const meta = engine.metadata
  if (!meta) {
    return emptyResult(settings, 'wholeStimulus', WHOLE_STIMULUS_AOI_LABEL)
  }

  const aois = getAois(engine, settings.stimulusId)
  const participantIds = getParticipantsIds(
    engine,
    settings.groupId,
    settings.stimulusId
  )

  const scope = resolveScope(aois, settings.selectedAoiId)
  const scopeIndex = scope.kind === 'aoi' ? scope.aoiIndex : aois.length + 1

  const { metrics, instances } = resolveMetrics(
    settings.enabledMetricIds,
    meta.metricInstances
  )
  if (metrics.length < 2 || participantIds.length === 0) {
    return emptyResult(settings, scope.kind, scope.label, scope.aoiId)
  }

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
    const timeStart = settings.timelineStart ?? 0
    const timeEnd = settings.timelineEnd ?? 0
    const pScope: Scope = { engine, stimulusId: settings.stimulusId, participantId: pid, timeStart, timeEnd }
    const results = queryBatch(instances, pScope)
    for (let mIdx = 0; mIdx < metrics.length; mIdx++) {
      const result = results.get(instances[mIdx].id)
      vectors[mIdx].values[p] = extractScopeValue(result, scopeIndex)
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
    scope: {
      kind: scope.kind,
      label: scope.label,
      aoiId: scope.aoiId,
    },
    participantLabels,
  }
}

function extractScopeValue(result: ReturnType<typeof queryBatch> extends Map<number, infer R> ? R | undefined : never, scopeIndex: number): number {
  if (!result) return Number.NaN
  switch (result.shape) {
    case 'scalar':          return result.value
    case 'aoi-vector':      return result.values[scopeIndex] ?? Number.NaN
    case 'aoi-pair-matrix': return result.matrix[scopeIndex] ?? Number.NaN
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

type ResolvedScope =
  | { kind: 'wholeStimulus'; label: string; aoiId?: undefined; aoiIndex?: undefined }
  | { kind: 'aoi'; label: string; aoiId: number; aoiIndex: number }

function resolveScope(
  aois: ReturnType<typeof getAois>,
  selectedAoiId: number | null
): ResolvedScope {
  if (selectedAoiId == null) {
    return { kind: 'wholeStimulus', label: WHOLE_STIMULUS_AOI_LABEL }
  }
  const aoiIndex = aois.findIndex(a => a.id === selectedAoiId)
  if (aoiIndex < 0) {
    return { kind: 'wholeStimulus', label: WHOLE_STIMULUS_AOI_LABEL }
  }
  return {
    kind: 'aoi',
    label: aois[aoiIndex].displayedName,
    aoiId: aois[aoiIndex].id,
    aoiIndex,
  }
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
          points.push({
            x,
            y,
            participantLabel: participantLabels[i],
          })
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

function emptyResult(
  settings: MetricCorrelationSettings,
  kind: 'aoi' | 'wholeStimulus',
  label: string,
  aoiId?: number
): MetricCorrelationResult {
  return {
    metrics: [],
    vectors: [],
    cells: [],
    correlationMethod: settings.correlationMethod,
    sampleSize: 0,
    scope: { kind, label, aoiId },
  }
}
