/**
 * Transformer for evolving metrics data.
 *
 * The metric instance drives both WHAT is computed and HOW the window is sized:
 * - Sequence metrics (windowUnit 'fixations', e.g. RQA): per W-fixation window,
 *   compute the scalar via the metric's own selector and map to the time grid
 *   using fixation timestamps.
 * - Other metrics: time-based window. At each bin the metric is queried over
 *   `[center - halfWindow, center + halfWindow]` via the DSL's `query()`.
 *
 * Instances with no windowing config use stepSize as the window (tumbling bins).
 * Empty bins are NaN — the renderer shows these as a distinct "no data" colour.
 */
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import {
  getParticipants,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import {
  query,
  getMetric,
  extractFixationSequence,
  computeSequenceScalar,
  type MetricInstance,
  type Scope,
} from '$lib/metrics'
import { getEvolvingMetricsXAxisLabel } from '../const'
import type {
  EvolvingMetricsSettings,
  EvolvingMetricsResult,
  EvolvingMetricsParticipant,
} from '../types'

const MIN_FIXATIONS_SEQUENCE = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveInstance(
  engine: DataEngine,
  selectedMetricId: number | null
): MetricInstance | null {
  if (selectedMetricId === null) return null
  const meta = engine.metadata
  if (!meta) return null
  return (meta.metricInstances ?? []).find(i => i.id === selectedMetricId) ?? null
}

function isSequenceInstance(instance: MetricInstance): boolean {
  return getMetric(instance.baseId)?.meta.windowUnit === 'fixations'
}

function windowDescLabel(instance: MetricInstance): string {
  const w = instance.windowing
  if (!w) return ''
  const isSeq = isSequenceInstance(instance)
  const unit = isSeq ? 'fix' : 'ms'
  const modeLabel = w.mode === 'sliding' ? 'Sliding' : 'Epoch'
  if (!isSeq && w.stepSize != null && w.stepSize !== w.windowSize) {
    return `${modeLabel} ${w.windowSize}${unit} win / ${w.stepSize}ms step`
  }
  return `${modeLabel} ${w.windowSize} ${unit}`
}

function deriveStepSize(instance: MetricInstance): number {
  const isSeq = isSequenceInstance(instance)
  if (!isSeq) {
    if (instance.windowing?.stepSize != null) return instance.windowing.stepSize
    if (instance.windowing?.mode === 'epoch') return instance.windowing.windowSize
  }
  return 100
}

// ─── Sequence path: read fixation sequence + per-window scalar ───────────────

function computeSequenceBins(
  instance: MetricInstance,
  seq: readonly number[],
  timestamps: readonly number[],
  binCount: number,
  stepSize: number,
  timelineMin: number,
): Float32Array {
  const W = instance.windowing?.windowSize ?? 20
  const reduction = instance.windowing?.reduction ?? 'mean'
  const N = seq.length
  const values = new Float32Array(binCount).fill(NaN)

  if (N < Math.max(W, MIN_FIXATIONS_SEQUENCE)) return values

  const sums = reduction === 'mean' ? new Float64Array(binCount) : null
  const cnts = reduction === 'mean' ? new Uint32Array(binCount) : null

  for (let i = 0; i + W <= N; i++) {
    const sub = seq.slice(i, i + W)
    const scalar = computeSequenceScalar(instance, sub)
    if (!Number.isFinite(scalar)) continue

    const centerTime = timestamps[i + Math.floor(W / 2)]
    const bin = Math.floor((centerTime - timelineMin) / stepSize)
    if (bin < 0 || bin >= binCount) continue

    switch (reduction) {
      case 'mean':  sums![bin] += scalar; cnts![bin]++; break
      case 'max':   values[bin] = Number.isNaN(values[bin]) ? scalar : Math.max(values[bin], scalar); break
      case 'min':   values[bin] = Number.isNaN(values[bin]) ? scalar : Math.min(values[bin], scalar); break
      case 'final': values[bin] = scalar; break
    }
  }

  if (reduction === 'mean') {
    for (let i = 0; i < binCount; i++)
      if (cnts![i] > 0) values[i] = sums![i] / cnts![i]
  }
  return values
}

// ─── Time-bin path: query metric over sliding window per bin ─────────────────

function computeTimeBins(
  instance: MetricInstance,
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  binCount: number,
  stepSize: number,
  halfWindowMs: number,
  timelineMin: number,
): Float32Array {
  const values = new Float32Array(binCount).fill(NaN)
  // Strip windowing so `query()` returns a raw per-bin result we place on the
  // timeline ourselves. Projection is preserved and applied inside query().
  const bare: MetricInstance = { ...instance, windowing: undefined }

  for (let i = 0; i < binCount; i++) {
    const center = timelineMin + i * stepSize + stepSize / 2
    const wStart = Math.max(0, center - halfWindowMs)
    const wEnd = center + halfWindowMs
    const scope: Scope = { engine, stimulusId, participantId, timeStart: wStart, timeEnd: wEnd }
    const result = query(bare, scope)
    const v = result.shape === 'scalar' ? result.value : Number.NaN
    if (Number.isFinite(v)) values[i] = v
  }
  return values
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function getEvolvingMetricsData(
  engine: DataEngine,
  settings: Pick<EvolvingMetricsSettings, 'stimulusId' | 'groupId' | 'selectedMetricId'> & {
    timelineMin?: number
    timelineMax?: number
  }
): EvolvingMetricsResult | null {
  const meta = engine.metadata
  if (!meta) return null

  const instance = resolveInstance(engine, settings.selectedMetricId)
  if (!instance) return null

  if (!instance.windowing) return null

  const metric = getMetric(instance.baseId)
  if (!metric) return null

  const isSeq = isSequenceInstance(instance)
  const { stimulusId, groupId } = settings
  const stepSize = deriveStepSize(instance)

  const windowSizeMs = instance.windowing?.windowSize ?? stepSize
  const halfWindowMs = windowSizeMs / 2

  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const participantEntities = getParticipants(engine, groupId, stimulusId)
  const numParticipants = participantIds.length

  if (numParticipants === 0) return null

  let maxTime = 0
  for (let i = 0; i < numParticipants; i++) {
    const t = getParticipantEndTime(engine, stimulusId, participantIds[i])
    if (t > maxTime) maxTime = t
  }
  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const duration = Math.max(1, timelineMax - timelineMin)
  const binCount = Math.max(1, Math.ceil(duration / stepSize))

  const sequences = isSeq
    ? participantIds.map(pid => extractFixationSequence(engine, stimulusId, pid))
    : []

  let valueMin = Infinity
  let valueMax = -Infinity
  const participants: EvolvingMetricsParticipant[] = new Array(numParticipants)

  for (let p = 0; p < numParticipants; p++) {
    const pid = participantIds[p]
    const entity = participantEntities[p]

    const values = isSeq
      ? computeSequenceBins(instance, sequences[p].seq, sequences[p].timestamps, binCount, stepSize, timelineMin)
      : computeTimeBins(instance, engine, stimulusId, pid, binCount, stepSize, halfWindowMs, timelineMin)

    for (let i = 0; i < binCount; i++) {
      const v = values[i]
      if (!Number.isFinite(v)) continue
      if (v < valueMin) valueMin = v
      if (v > valueMax) valueMax = v
    }

    participants[p] = {
      id: pid,
      label: entity?.displayedName ?? entity?.originalName ?? `P${pid}`,
      values,
    }
  }

  if (!Number.isFinite(valueMin)) valueMin = 0
  if (valueMax <= valueMin) valueMax = valueMin + 1

  const effectiveMaxTime = timelineMin + binCount * stepSize
  const timeline = createAdaptiveTimeline(timelineMin, effectiveMaxTime, 6)

  const xAxisLabel = getEvolvingMetricsXAxisLabel(windowDescLabel(instance))
  const yAxisLabel = `${metric.meta.label} [${metric.meta.unit}]`

  return {
    participants,
    timeline,
    binCount,
    stepSize,
    xAxisLabel,
    yAxisLabel,
    maxTime: effectiveMaxTime,
    valueMin,
    valueMax,
  }
}
