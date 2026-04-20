/**
 * Transformer for evolving-metrics data.
 *
 * Relies on the metrics runtime for windowing: `query()` on a windowed instance
 * returns `{shape: 'scalar-timeseries', values, timeline}`. The transformer's
 * only job is to re-bin that timeseries onto the plot's ms grid:
 *
 *   - Time-windowed metrics: `timeline` is ms start-of-window — each value
 *     slots into the corresponding bin.
 *   - Fixation-windowed metrics: `timeline` is fix-index start-of-window —
 *     the bin is looked up via the participant's fixation-timestamp sequence.
 *     When multiple windows fall in the same bin (sliding mode), the bin
 *     becomes their arithmetic mean.
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
  windowLabel,
  type MetricInstance,
  type Scope,
  type WindowSpec,
} from '$lib/metrics'
import { getEvolvingMetricsXAxisLabel } from '../const'
import type {
  EvolvingMetricsSettings,
  EvolvingMetricsResult,
  EvolvingMetricsParticipant,
} from '../types'

function resolveInstance(
  engine: DataEngine,
  selectedMetricId: number | null,
): MetricInstance | null {
  if (selectedMetricId === null) return null
  const meta = engine.metadata
  if (!meta) return null
  return (meta.metricInstances ?? []).find(i => i.id === selectedMetricId) ?? null
}

function defaultStepSize(window: WindowSpec, windowUnit: 'ms' | 'fixations'): number {
  if (windowUnit === 'fixations') return 100
  return window.mode === 'epoch' ? window.windowSize : (window.stepSize ?? window.windowSize)
}

function mapTimeseriesToBins(
  values: readonly number[],
  timeline: readonly number[],
  binCount: number,
  stepSize: number,
  timelineMin: number,
): Float32Array {
  const out = new Float32Array(binCount).fill(NaN)
  const sums = new Float64Array(binCount)
  const counts = new Uint32Array(binCount)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) continue
    const bin = Math.floor((timeline[i] - timelineMin) / stepSize)
    if (bin < 0 || bin >= binCount) continue
    sums[bin] += v
    counts[bin]++
  }
  for (let i = 0; i < binCount; i++) {
    if (counts[i] > 0) out[i] = sums[i] / counts[i]
  }
  return out
}

function mapFixIndexTimelineToMs(
  timeline: readonly number[],
  windowSize: number,
  timestamps: readonly number[],
): number[] {
  const centerOffset = Math.floor(windowSize / 2)
  const out: number[] = new Array(timeline.length)
  for (let i = 0; i < timeline.length; i++) {
    const centerIdx = timeline[i] + centerOffset
    const ts = timestamps[centerIdx]
    out[i] = ts ?? Number.NaN
  }
  return out
}

export function getEvolvingMetricsData(
  engine: DataEngine,
  settings: Pick<EvolvingMetricsSettings, 'stimulusId' | 'groupId' | 'selectedMetricId'> & {
    timelineMin?: number
    timelineMax?: number
  },
): EvolvingMetricsResult | null {
  const meta = engine.metadata
  if (!meta) return null

  const instance = resolveInstance(engine, settings.selectedMetricId)
  if (!instance || instance.projection.kind !== 'windowed') return null

  const metric = getMetric(instance.baseId)
  if (!metric) return null

  const { stimulusId, groupId } = settings
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

  const window = instance.projection.window
  const windowUnit = metric.meta.windowUnit
  const stepSize = defaultStepSize(window, windowUnit)
  const binCount = Math.max(1, Math.ceil(duration / stepSize))

  let valueMin = Infinity
  let valueMax = -Infinity
  const participants: EvolvingMetricsParticipant[] = new Array(numParticipants)

  for (let p = 0; p < numParticipants; p++) {
    const pid = participantIds[p]
    const entity = participantEntities[p]
    const scope: Scope = {
      engine, stimulusId, participantId: pid,
      timeStart: timelineMin, timeEnd: timelineMax,
    }
    const result = query(instance, scope)
    if (result.shape !== 'scalar-timeseries') {
      participants[p] = {
        id: pid,
        label: entity?.displayedName ?? entity?.originalName ?? `P${pid}`,
        values: new Float32Array(binCount).fill(NaN),
      }
      continue
    }

    const msTimeline = windowUnit === 'fixations'
      ? mapFixIndexTimelineToMs(
          result.timeline,
          window.windowSize,
          extractFixationSequence(engine, stimulusId, pid).timestamps,
        )
      : result.timeline

    const values = mapTimeseriesToBins(result.values, msTimeline, binCount, stepSize, timelineMin)

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

  const unitSuffix = windowUnit === 'fixations' ? ' fix' : ' ms'
  const xAxisLabel = getEvolvingMetricsXAxisLabel(windowLabel(window) + unitSuffix)
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
