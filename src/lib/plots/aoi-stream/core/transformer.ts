import {
  getAois,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { formatMetricLabel } from '$lib/plots/shared/metricLabels'
import {
  queryGroup,
  resolveInstance,
  getMetric,
  windowLabel,
  type GroupScope,
  type MetricInstance,
} from '$lib/metrics'
import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import type { AoiStreamPlotSettings } from '../types'
import { COLOR_FALLBACKS } from '$lib/color'

/**
 * Compute aoi-stream data via a single `queryGroup()` call into the metric
 * library. Cross-participant aggregation lives natively in the library —
 * `runWindowedGroup` reduces per-cell across participants per the recipe's
 * `groupAggregation` (mean / sum / median) — so this transformer is a thin
 * mapper from `aoi-vector-timeseries` to `AoiStreamPlotResult`.
 *
 * Per-bin per-AOI values stay in the metric's NATIVE UNIT — `ms` for
 * `absoluteTime`, `count` for `fixationCount` / `visitCount`, `%` for
 * `relativeTime`. The plot's y-axis label and range adapt accordingly;
 * nothing is forced into a percentage.
 *
 * Bin layout (size + count) is derived entirely from the resolved
 * `MetricInstance`'s `WindowedProjection`. Plot settings carry only the
 * instance id; bin size lives on the metric.
 */
export function getAoiStreamPlotData(
  engine: DataEngine,
  settings: Pick<
    AoiStreamPlotSettings,
    'stimulusId' | 'groupId' | 'metricInstanceId'
  > & {
    timelineMin?: number
    timelineMax?: number
  }
): AoiStreamPlotResult | null {
  const meta = engine.metadata
  if (!meta) return null

  const instance: MetricInstance | undefined = resolveInstance(
    meta.metricInstances ?? [],
    settings.metricInstanceId ?? null,
  )
  if (!instance || instance.projection.kind !== 'windowed') return null

  const windowSize = instance.projection.window.windowSize
  const stepSize = instance.projection.window.stepSize
  if (!Number.isFinite(windowSize) || windowSize <= 0) return null
  if (!Number.isFinite(stepSize) || stepSize <= 0) return null

  const { stimulusId, groupId } = settings
  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  if (participantIds.length === 0) return null

  let maxTime = 0
  for (let i = 0; i < participantIds.length; i++) {
    const t = getParticipantEndTime(engine, stimulusId, participantIds[i])
    if (t > maxTime) maxTime = t
  }
  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  // Pass the user's requested range straight through to the metric library.
  // `runWindowedGroup` produces `floor((range - windowSize) / stepSize) + 1`
  // windows (or zero if the range is shorter than the window); we use the
  // returned `vectors.length` as the canonical bin count rather than a
  // pre-computed `ceil(range / windowSize)` that silently truncated sliding
  // results.
  const groupScope: GroupScope = {
    engine,
    stimulusId,
    participantIds,
    timeStart: timelineMin,
    timeEnd: Math.max(timelineMin + windowSize, timelineMax),
  }
  const result = queryGroup(instance, groupScope)
  if (result.shape !== 'aoi-vector-timeseries') return null

  // Reshape the library's per-window aoi-vectors into per-AOI time series.
  // `result.slots` is the authoritative slot layout — never reach into
  // vectors by hardcoded indices.
  const { noAoiSlot } = result.slots
  const aoiCount = noAoiSlot
  const totalSlots = aoiCount + 1 // AOI slots + the noAoi sentinel
  const orderedAois = getAois(engine, stimulusId)

  const vectors = result.vectors
  const binCount = Math.max(1, vectors.length)

  const accums: Float32Array[] = new Array(totalSlots)
  for (let i = 0; i < totalSlots; i++) accums[i] = new Float32Array(binCount)
  for (let w = 0; w < vectors.length; w++) {
    const v = vectors[w]
    for (let s = 0; s < aoiCount; s++) {
      const x = v[s]
      if (Number.isFinite(x)) accums[s][w] = x
    }
    const noAoi = v[noAoiSlot]
    if (Number.isFinite(noAoi)) accums[noAoiSlot][w] = noAoi
  }

  const { noAoiTreatment } = meta
  const series: AoiStreamPlotSeries[] = new Array(totalSlots)
  for (let i = 0; i < aoiCount; i++) {
    const aoi = orderedAois[i]
    series[i] = {
      id: aoi.id,
      label: aoi.displayedName || aoi.originalName || 'Unknown',
      color: aoi.color || COLOR_FALLBACKS.BLACK,
      values: accums[i],
    }
  }
  series[aoiCount] = {
    id: -1,
    label: noAoiTreatment.displayedName,
    color: noAoiTreatment.color,
    values: accums[aoiCount],
  }

  let maxTotal = 0
  let maxValue = 0
  for (let b = 0; b < binCount; b++) {
    let total = 0
    for (let s = 0; s < totalSlots; s++) {
      const v = accums[s][b]
      total += v
      if (v > maxValue) maxValue = v
    }
    if (total > maxTotal) maxTotal = total
  }

  // The plotted time range is [first window start, last window end]:
  //   firstStart = timelineMin
  //   lastEnd    = timelineMin + (binCount - 1) * stepSize + windowSize
  // For non-overlapping (step === window) this equals binCount × windowSize.
  // For sliding (step < window) it is shorter than the user-requested
  // timelineMax when (timelineMax - timelineMin) is not on a step boundary —
  // the trailing partial window simply doesn't fit and is correctly dropped.
  const plotRange = (binCount - 1) * stepSize + windowSize
  const plotStart = timelineMin
  const plotEnd = plotStart + plotRange

  const metric = getMetric(instance.baseId)
  return {
    series,
    timeline: createAdaptiveTimeline(plotStart, plotEnd, 6),
    binCount,
    windowSize,
    stepSize,
    maxTime: plotEnd,
    participants: participantIds.length,
    maxTotal,
    maxValue,
    yAxisLabel: formatMetricLabel(metric),
    windowLabel: windowLabel(
      instance.projection.window,
      metric?.meta.windowUnit ?? 'ms',
    ),
  }
}
