/**
 * Transformer for evolving-metrics data.
 *
 * Turns the runtime's `scalar-timeseries` output into a list of
 * `EvolvingMetricsWindow`s per participant. The list is a **step function on
 * the time axis**: value `w.value` is held across `[w.startMs, w.endMs)`,
 * with `w.centerMs` carrying the scientific anchor (midpoint of the data
 * that produced the measurement) as semantic metadata. Every visualization
 * — heatmap rectangles, overlay step lines, aggregate sampling, hover
 * lookups — consumes this single signal definition.
 *
 * The paint rules live in `windowSpans.ts` — pure and unit-tested, because a
 * span that reached over unmeasured time was invisible from here. This file
 * resolves the metric, the display stride and each participant's scope, then
 * hands over.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getParticipant,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { buildMetricLabel } from '$lib/plots/shared/labels'
import { resolveDisplayStride, DEFAULT_MAX_COLUMNS } from '$lib/plots/shared/displayBudget'
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
  type WindowedProjection,
} from '$lib/metrics'
import { getEvolvingMetricsXAxisLabel } from '../const'
import { fixationWindowSpans, timeWindowSpans } from './windowSpans'
import type {
  EvolvingMetricsSettings,
  EvolvingMetricsResult,
  EvolvingMetricsParticipant,
  EvolvingMetricsWindow,
} from '../types'

const CONTRACT = { outputShape: 'scalar', windowing: 'required', crossParticipant: 'per-participant' } as const satisfies PlotMetricContract

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

export function getEvolvingMetricsData(
  engine: DataEngine,
  settings: Pick<EvolvingMetricsSettings, 'stimulusId' | 'groupId' | 'metricInstanceIds' | 'aoiSelectionId'> & {
    timelineMin?: number
    timelineMax?: number
    /**
     * Display budget: the most windows to evaluate/draw per participant. The
     * configured step is decimated to a strided `displayStep` so only ~this many
     * windows are produced per series (bounded by the plot's on-screen width),
     * regardless of recording length. Defaults to {@link DEFAULT_MAX_COLUMNS}.
     */
    maxColumns?: number
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
  // Centered anchor: each window's value is attributed to its middle
  // fixation. Chosen for evolution-over-time semantics — zero phase lag,
  // peaks appear where they occurred. TODO: a future event-locked plot
  // (window ends at a marked event) will need retrospective anchoring
  // (midOffsetFix = windowSize - 1). That's a separate plot type with its
  // own transformer, not a setting on this one.
  const midOffsetFix = Math.floor(window.windowSize / 2)

  // Display budget: never produce more windows than the plot's width can show.
  // We widen only the STEP (draw every `stride`-th configured window); the
  // `windowSize` is unchanged, so each value still summarises a full window and
  // the centered-anchor semantics above hold. `fullW` and `displayStep` are in
  // the metric's window unit — ms (time-windowed) or fixation count
  // (fixation-windowed) — so they must be measured consistently per unit.
  const maxColumns = settings.maxColumns ?? DEFAULT_MAX_COLUMNS
  let fullW: number
  if (windowUnit === 'fixations') {
    // Bound by the participant with the most fixations (O(1) range lookup) so
    // the longest series stays within budget; shorter ones produce fewer.
    const reader = engine.getReader()
    let maxFix = 0
    if (reader) {
      for (let i = 0; i < numParticipants; i++) {
        const { startIndex, endIndex } = reader.getFixationRange(stimulusId, participantIds[i])
        const n = endIndex - startIndex
        if (n > maxFix) maxFix = n
      }
    }
    fullW = Math.floor((maxFix - window.windowSize) / window.stepSize) + 1
  } else {
    // Bound by the global timeline extent (ms).
    const extent = Math.max(timelineMin + window.windowSize, timelineMax)
    fullW = Math.floor((extent - timelineMin - window.windowSize) / window.stepSize) + 1
  }
  const { stride, displayStep } = resolveDisplayStride(fullW, window.stepSize, maxColumns)

  // Query at the strided step (windows land on real configured positions). The
  // step-dependent geometry below reads `effStep` so decimated cells tile the
  // axis at the display resolution; the axis LABEL keeps the configured `window`.
  const effStep = displayStep
  const effInstance =
    stride === 1
      ? instance
      : {
          ...instance,
          projection: {
            kind: 'windowed' as const,
            window: { windowSize: window.windowSize, stepSize: displayStep },
            inner: (instance.projection as WindowedProjection).inner,
          },
        }

  let valueMin = Infinity
  let valueMax = -Infinity
  const participants: EvolvingMetricsParticipant[] = new Array(numParticipants)

  for (let p = 0; p < numParticipants; p++) {
    const pid = participantIds[p]
    const label = getParticipant(engine, pid).displayedName
    const scope: Scope = {
      engine, stimulusId, participantId: pid,
      timeStart: timelineMin,
      // Clamp to this participant's own run end so windows past their data
      // aren't synthesised — they'd report 0 (count) or NaN (mean), conflating
      // missing data with real zero observations.
      timeEnd: Math.min(timelineMax, participantEnds[p]),
      aoiSelectionId: settings.aoiSelectionId,
    }
    const result = asScalarTimeseries(query(effInstance, scope))
    if (!result || !result.timeline) {
      participants[p] = { id: pid, label, windows: [] }
      continue
    }

    const values = result.values
    const timeline = result.timeline
    let windows: EvolvingMetricsWindow[]

    if (windowUnit === 'fixations') {
      // Keep extract's filter in lock-step with the recipe's onFixation AND its
      // scope with the query's, or `timeline`'s indices address a different
      // sequence and every cell lands on the wrong fixation. The filter half is
      // the instance's `include_no_aoi` (default false).
      const seq = extractFixationSequence(engine, stimulusId, pid, {
        includeNoAoi: Boolean(instance.params?.include_no_aoi),
        aoiSelectionId: settings.aoiSelectionId,
        timeStart: scope.timeStart,
        timeEnd: scope.timeEnd,
      })
      // Strided step: the query emitted windows `stride` fixations apart.
      windows = fixationWindowSpans(
        timeline, values, seq.timestamps, seq.endTimestamps,
        window.windowSize, effStep, midOffsetFix,
      )
    } else {
      windows = timeWindowSpans(timeline, values, window.windowSize)
    }
    for (const w of windows) {
      if (w.value < valueMin) valueMin = w.value
      if (w.value > valueMax) valueMax = w.value
    }

    participants[p] = { id: pid, label, windows }
  }

  if (!Number.isFinite(valueMin)) valueMin = 0
  if (valueMax <= valueMin) valueMax = valueMin + 1

  const timeline = createAdaptiveTimeline(timelineMin, timelineMax, 6)

  const xAxisLabel = getEvolvingMetricsXAxisLabel(windowLabel(window, windowUnit))
  // Time-axis plot: the window is on x, so the y label takes the projection's
  // SLICE only — which AOI / type / matrix cell this series is. Dropping the
  // projection wholesale (the old behaviour) left two plots of different AOIs
  // with identical y labels, indistinguishable once exported.
  const yAxisLabel = buildMetricLabel(instance, { projection: 'leaf' })

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
