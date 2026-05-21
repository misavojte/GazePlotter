/**
 * Transformer for evolving-metrics data.
 *
 * Turns the runtime's `scalar-timeseries` output into a list of
 * `EvolvingMetricsWindow`s per participant. Each window carries a scientific
 * `centerMs` anchor (the midpoint of its data) plus paint boundaries that
 * drive heatmap rectangles. Overlay line plots anchor each point at
 * `centerMs`.
 *
 *   - Fixation-windowed metrics paint the **middle fixation's own span** —
 *     `[timestamps[midFix], endTimestamps[midFix]]`. Adjacent windows are
 *     visually separated by the saccade between their middle fixations,
 *     making each SW measurement individually visible (critical for small
 *     windows like Ida's 21 fixations with a 20-fix / 1-step sliding metric,
 *     which produces just two measurements).
 *   - Time-windowed metrics paint Voronoi-style boundaries derived from
 *     adjacent centres — when `stepSize === windowSize` this equals the
 *     window's own span (non-overlapping), otherwise it equals `stepSize`
 *     wide centred on each `centerMs` (overlapping). Both give gap-free
 *     coverage on the ms axis.
 */
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import {
  getParticipants,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { formatMetricLabel } from '$lib/plots/shared/metricLabels'
import {
  asScalarTimeseries,
  resolveMetric,
} from '$lib/plots/shared'
import {
  query,
  getMetric,
  extractFixationSequence,
  windowLabel,
  type PlotMetricContract,
  type Scope,
} from '$lib/metrics'
import { getEvolvingMetricsXAxisLabel } from '../const'
import type {
  EvolvingMetricsSettings,
  EvolvingMetricsResult,
  EvolvingMetricsParticipant,
  EvolvingMetricsWindow,
} from '../types'

const CONTRACT = { outputShape: 'scalar', windowing: 'required' } as const satisfies PlotMetricContract

/**
 * Empty result shell. `noMetric: true` only when the configured instance is
 * missing or doesn't match the contract — other "no data" paths (no
 * participants, broken projection) return the empty shell without the flag,
 * matching the bar / transition-matrix conventions.
 */
function emptyEvolvingMetricsResult(noMetric = false): EvolvingMetricsResult {
  return {
    participants: [],
    timeline: createAdaptiveTimeline(0, 100, 6),
    xAxisLabel: '',
    yAxisLabel: '',
    maxTime: 0,
    valueMin: 0,
    valueMax: 1,
    ...(noMetric ? { noMetric: true as const } : {}),
  }
}

/**
 * Given an array of center-ms per window, return paired
 * `(startMs[], endMs[])` Voronoi boundaries. First and last windows use
 * symmetric half-gap extrapolation so they render the same width as their
 * interior neighbours. `NaN` centers produce `NaN` boundaries (skipped
 * downstream). Arrays with a single finite center return `null` for its
 * boundaries — the caller falls back to the window's raw data span.
 */
function voronoiBoundaries(
  centers: Float64Array,
): { starts: Float64Array; ends: Float64Array } {
  const N = centers.length
  const starts = new Float64Array(N).fill(NaN)
  const ends = new Float64Array(N).fill(NaN)

  // Walk only the valid (finite) centers so NaN slots in the middle don't
  // break Voronoi for their neighbours — they just get skipped.
  const validIdx: number[] = []
  for (let i = 0; i < N; i++) if (Number.isFinite(centers[i])) validIdx.push(i)

  for (let k = 0; k < validIdx.length; k++) {
    const i = validIdx[k]
    const c = centers[i]
    const hasPrev = k > 0
    const hasNext = k < validIdx.length - 1
    if (hasPrev && hasNext) {
      const prev = centers[validIdx[k - 1]]
      const next = centers[validIdx[k + 1]]
      starts[i] = (prev + c) / 2
      ends[i] = (c + next) / 2
    } else if (hasNext) {
      const next = centers[validIdx[k + 1]]
      const half = (next - c) / 2
      starts[i] = c - half
      ends[i] = c + half
    } else if (hasPrev) {
      const prev = centers[validIdx[k - 1]]
      const half = (c - prev) / 2
      starts[i] = c - half
      ends[i] = c + half
    }
    // else: sole valid center — leave NaN, caller falls back to raw span
  }
  return { starts, ends }
}

export function getEvolvingMetricsData(
  engine: DataEngine,
  settings: Pick<EvolvingMetricsSettings, 'stimulusId' | 'groupId' | 'metricInstanceIds'> & {
    timelineMin?: number
    timelineMax?: number
  },
): EvolvingMetricsResult {
  const meta = engine.metadata
  if (!meta) return emptyEvolvingMetricsResult()

  const resolved = resolveMetric({
    instances: meta.metricInstances,
    id: settings.metricInstanceIds?.[0] ?? null,
    contract: CONTRACT,
  })
  if (!resolved.ok) return emptyEvolvingMetricsResult(true)

  const { instance, window } = resolved
  const metric = getMetric(instance.baseId)
  if (!metric) return emptyEvolvingMetricsResult(true)

  const { stimulusId, groupId } = settings
  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const participantEntities = getParticipants(engine, groupId, stimulusId)
  const numParticipants = participantIds.length
  if (numParticipants === 0) return emptyEvolvingMetricsResult()

  const participantEnds: number[] = new Array(numParticipants)
  let maxTime = 0
  for (let i = 0; i < numParticipants; i++) {
    const t = getParticipantEndTime(engine, stimulusId, participantIds[i])
    participantEnds[i] = t
    if (t > maxTime) maxTime = t
  }
  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime

  const windowUnit = metric.meta.windowUnit
  const halfWindowSize = window.windowSize / 2
  const midOffsetFix = Math.floor(window.windowSize / 2)

  let valueMin = Infinity
  let valueMax = -Infinity
  const participants: EvolvingMetricsParticipant[] = new Array(numParticipants)

  for (let p = 0; p < numParticipants; p++) {
    const pid = participantIds[p]
    const entity = participantEntities[p]
    const label = entity?.displayedName ?? entity?.originalName ?? `P${pid}`
    const scope: Scope = {
      engine, stimulusId, participantId: pid,
      timeStart: timelineMin,
      // Clamp to this participant's own run end so windows past their data
      // aren't synthesised — they'd report 0 (count) or NaN (mean), conflating
      // missing data with real zero observations.
      timeEnd: Math.min(timelineMax, participantEnds[p]),
    }
    const result = asScalarTimeseries(query(instance, scope))
    if (!result || !result.timeline) {
      participants[p] = { id: pid, label, windows: [] }
      continue
    }

    const values = result.values
    const timeline = result.timeline
    const N = values.length
    const windows: EvolvingMetricsWindow[] = []

    if (windowUnit === 'fixations') {
      // Middle-fixation painting: each SW measurement is visualised across
      // the span of the single fixation that sits at the window's centre.
      // Adjacent windows are naturally separated by the saccade between
      // their centre fixations.
      // Keep extract's filter in lock-step with the recipe's onFixation so
      // timeline indices stay aligned. For RQA metrics this is driven by the
      // instance's `include_no_aoi` boolean (default false).
      const includeNoAoi = Boolean(instance.params?.include_no_aoi)
      const seq = extractFixationSequence(engine, stimulusId, pid, { includeNoAoi })
      const totalFix = seq.timestamps.length
      for (let i = 0; i < N; i++) {
        const v = values[i]
        if (!Number.isFinite(v)) continue
        const midFix = timeline[i] + midOffsetFix
        if (midFix >= totalFix) continue
        const a = seq.timestamps[midFix]
        const b = seq.endTimestamps[midFix]
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue
        windows.push({ startMs: a, endMs: b, centerMs: (a + b) / 2, value: v })
        if (v < valueMin) valueMin = v
        if (v > valueMax) valueMax = v
      }
    } else {
      // Time-windowed: Voronoi boundaries give gap-free coverage (equal to
      // the window itself for epoch, `stepSize` wide for sliding).
      const centers = new Float64Array(N).fill(NaN)
      for (let i = 0; i < N; i++) {
        if (!Number.isFinite(values[i])) continue
        centers[i] = timeline[i] + halfWindowSize
      }
      const { starts, ends } = voronoiBoundaries(centers)
      for (let i = 0; i < N; i++) {
        const v = values[i]
        if (!Number.isFinite(v)) continue
        const c = centers[i]
        if (!Number.isFinite(c)) continue
        let startMs = starts[i]
        let endMs = ends[i]
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
          // Lone window fallback: use the raw time-window span.
          startMs = timeline[i]
          endMs = timeline[i] + window.windowSize
        }
        if (endMs <= startMs) continue
        windows.push({ startMs, endMs, centerMs: c, value: v })
        if (v < valueMin) valueMin = v
        if (v > valueMax) valueMax = v
      }
    }

    participants[p] = { id: pid, label, windows }
  }

  if (!Number.isFinite(valueMin)) valueMin = 0
  if (valueMax <= valueMin) valueMax = valueMin + 1

  const timeline = createAdaptiveTimeline(timelineMin, timelineMax, 6)

  const xAxisLabel = getEvolvingMetricsXAxisLabel(windowLabel(window, windowUnit))
  const yAxisLabel = formatMetricLabel(metric)

  return {
    participants,
    timeline,
    xAxisLabel,
    yAxisLabel,
    maxTime: timelineMax,
    valueMin,
    valueMax,
  }
}
