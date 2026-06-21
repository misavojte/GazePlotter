import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipantsIds } from '$lib/data/engine'
import { getMetric, queryBatch, type MetricInstance, type Scope } from '$lib/metrics'
import { asScalar, buildMetricLabel } from '$lib/plots/shared'
import type {
  CorrelationCell,
  CorrelationPoint,
  MetricCorrelationResult,
  MetricCorrelationSettings,
  MetricDescriptor,
  MetricVector,
} from '../types'
import { correlate } from './correlations'
import { MIN_CORRELATION_SAMPLES } from '../const'

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
    settings.metricInstanceIds,
    meta.metricInstances
  )
  if (metrics.length < 2) return emptyResult(settings, true)
  if (participantIds.length === 0) return emptyResult(settings)

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
      const scalar = result ? asScalar(result) : null
      vectors[mIdx].values[p] = scalar?.value ?? Number.NaN
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
    timelineStart: settings.timelineStart ?? 0,
    timelineEnd: settings.timelineEnd ?? 0,
  }
}

function resolveMetrics(
  enabledIds: readonly string[],
  workspaceInstances: readonly MetricInstance[] | undefined
): { metrics: MetricDescriptor[]; instances: MetricInstance[] } {
  const library: readonly MetricInstance[] = workspaceInstances ?? []
  const enabledSet = new Set(enabledIds)

  const selected = library.filter(inst => enabledSet.has(inst.id))

  const metrics: MetricDescriptor[] = []
  const instances: MetricInstance[] = []
  for (const inst of selected) {
    const metric = getMetric(inst.baseId)
    if (!metric) continue
    // Correlation rows/cols must self-distinguish: name + derived qualifiers (so
    // two variants of one base metric don't collide). Unit is shown on the
    // diagonal, not here — hence `unit: false`.
    const label = buildMetricLabel(inst, metric, { unit: false, includeProjection: true })
    metrics.push({ id: inst.id, label, unit: metric.meta.unit })
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
      const outcome = correlate(colVec, rowVec, method)
      const n = outcome.n
      // Statistical-soundness display floor: a coefficient over too few complete
      // pairs is uninformative, so render the cell as missing ("—") rather than
      // painting near-deterministic noise as signal. The math is unchanged; only
      // the display is gated. (n is still carried for the tooltip.)
      const r = n < MIN_CORRELATION_SAMPLES ? null : outcome.r

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

function emptyResult(settings: MetricCorrelationSettings, noMetric = false): MetricCorrelationResult {
  return {
    metrics: [],
    vectors: [],
    cells: [],
    correlationMethod: settings.correlationMethod,
    sampleSize: 0,
    ...(noMetric ? { noMetric: true as const } : {}),
  }
}
