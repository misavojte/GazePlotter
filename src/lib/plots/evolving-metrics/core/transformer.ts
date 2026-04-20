/**
 * Transformer for evolving metrics data.
 *
 * The metric instance drives both WHAT is computed and HOW the window is sized:
 * - RQA metrics (rqa-aoi): fixation-sequence-based window. Each sliding window
 *   of W fixations is computed and mapped to the time grid via fixationTimestamps.
 * - Other metrics: time-based window. At each time step the collector is called
 *   for the surrounding window [t - halfWindow, t + halfWindow].
 *
 * Instances with no windowing config use stepSize as the window (tumbling bins).
 * Empty bins are NaN — the renderer shows these as a distinct "no data" colour.
 */
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import {
  getParticipants,
  getParticipantsIds,
  getParticipantEndTime,
  getAois,
} from '$lib/data/engine'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { computeRqaAoiScalar } from '$lib/metrics/rqaAoiCompute'
import { getMetricDef } from '$lib/metrics/registry'
import type { MetricComputeContext } from '$lib/metrics/types'
import type { MetricInstance } from '$lib/data/types'
import { getEvolvingMetricsXAxisLabel } from '../const'
import type {
  EvolvingMetricsSettings,
  EvolvingMetricsResult,
  EvolvingMetricsParticipant,
} from '../types'

const MIN_FIXATIONS_RQA = 5

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

function isRqaInstance(instance: MetricInstance): boolean {
  return getMetricDef(instance.baseId)?.windowUnit === 'fixations'
}

function windowDescLabel(instance: MetricInstance): string {
  const w = instance.windowing
  if (!w) return ''
  const isRqa = isRqaInstance(instance)
  const unit = isRqa ? 'fix' : 'ms'
  const modeLabel = w.mode === 'sliding' ? 'Sliding' : 'Epoch'
  if (!isRqa && w.stepSize != null && w.stepSize !== w.windowSize) {
    return `${modeLabel} ${w.windowSize}${unit} win / ${w.stepSize}ms step`
  }
  return `${modeLabel} ${w.windowSize} ${unit}`
}

function deriveStepSize(instance: MetricInstance): number {
  const isRqa = isRqaInstance(instance)
  if (!isRqa) {
    if (instance.windowing?.stepSize != null) return instance.windowing.stepSize
    if (instance.windowing?.mode === 'epoch') return instance.windowing.windowSize
  }
  return 100
}

// ─── RQA path: read fixation sequence directly from engine ───────────────────

interface RqaSequenceData {
  seq: number[]
  timestamps: number[]
}

function _readFixationSequence(
  engine: DataEngine,
  stimulusId: number,
  participantId: number
): RqaSequenceData {
  const reader = engine.getReader()
  if (!reader) return { seq: [], timestamps: [] }
  const aois = getAois(engine, stimulusId)
  const hiddenAois = engine.metadata?.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set<number>(hiddenAois) : null
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aois.length; i++) aoiLookup.set(aois[i].id, i)
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const seq: number[] = []
  const timestamps: number[] = []
  const aoiSet = new Set<number>()
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    aoiSet.clear()
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(stimulusId, rawAois[r]))
      if (slot !== undefined) aoiSet.add(slot)
    }
    if (aoiSet.size === 1) {
      seq.push(aoiSet.values().next().value!)
      timestamps.push(reader.getSegmentStart(i))
    }
  }
  return { seq, timestamps }
}

function computeRqaBins(
  instance: MetricInstance,
  data: RqaSequenceData,
  binCount: number,
  stepSize: number,
  timelineMin: number
): Float32Array {
  const { seq, timestamps } = data
  const W = instance.windowing?.windowSize ?? 20
  const reduction = instance.windowing?.reduction ?? 'mean'
  const N = seq.length
  const values = new Float32Array(binCount).fill(NaN)

  if (N < Math.max(W, MIN_FIXATIONS_RQA)) return values

  const sums = reduction === 'mean' ? new Float64Array(binCount) : null
  const cnts = reduction === 'mean' ? new Uint32Array(binCount) : null

  for (let i = 0; i + W <= N; i++) {
    const sub = seq.slice(i, i + W)
    const scalar = computeRqaAoiScalar(instance, sub)
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

// ─── Non-RQA path: per-bin collector calls ───────────────────────────────────

function computeNonRqaBins(
  instance: MetricInstance,
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aoiIndex: number,
  binCount: number,
  stepSize: number,
  halfWindowMs: number,
  timelineMin: number
): Float32Array {
  const def = getMetricDef(instance.baseId)
  if (!def) return new Float32Array(binCount).fill(NaN)

  const values = new Float32Array(binCount).fill(NaN)

  for (let i = 0; i < binCount; i++) {
    const center = timelineMin + i * stepSize + stepSize / 2
    const wStart = Math.max(0, center - halfWindowMs)
    const wEnd = center + halfWindowMs
    const ctx: MetricComputeContext = { stimulusId, participantId, timeStart: wStart, timeEnd: wEnd }
    const v = def.compute(engine, ctx, instance)[aoiIndex] ?? Number.NaN
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

  const def = getMetricDef(instance.baseId)
  if (!def) return null

  const isRqa = isRqaInstance(instance)
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

  const aois = getAois(engine, stimulusId)
  const aoiIndex = aois.length + 1 // AnyFixation slot

  const rqaData: RqaSequenceData[] = isRqa
    ? participantIds.map(pid => _readFixationSequence(engine, stimulusId, pid))
    : []

  let valueMin = Infinity
  let valueMax = -Infinity
  const participants: EvolvingMetricsParticipant[] = new Array(numParticipants)

  for (let p = 0; p < numParticipants; p++) {
    const pid = participantIds[p]
    const entity = participantEntities[p]

    const values = isRqa
      ? computeRqaBins(instance, rqaData[p], binCount, stepSize, timelineMin)
      : computeNonRqaBins(instance, engine, stimulusId, pid, aoiIndex, binCount, stepSize, halfWindowMs, timelineMin)

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
  const yAxisLabel = `${def.label} [${def.unit}]`

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
