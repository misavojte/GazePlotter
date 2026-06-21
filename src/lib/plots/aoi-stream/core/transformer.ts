import {
  getAois,
  getParticipantsIds,
  getParticipantEndTime,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import { buildMetricLabel } from '$lib/plots/shared/labels'
import {
  asAoiVectorTimeseries,
  resolveMetric,
} from '$lib/plots/shared'
import {
  queryGroup,
  getMetric,
  windowLabel,
  type GroupScope,
  type PlotMetricContract,
  type WindowedProjection,
} from '$lib/metrics'
import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import type { AoiStreamPlotSettings } from '../types'
import { COLOR_FALLBACKS } from '$lib/color'

const CONTRACT = { outputShape: 'aoi-vector', windowing: 'required' } as const satisfies PlotMetricContract

/**
 * Upper bound on windows evaluated when no display budget is supplied (export /
 * headless). A stream can't show more bins than pixels; a fine step over a long
 * recording would otherwise produce millions of windows. The interactive view
 * passes a tighter budget derived from the plot's on-screen width.
 */
const DEFAULT_MAX_COLUMNS = 4096

/**
 * Empty result shell. Used for both "no metric configured" and "no data"
 * fallbacks; the discriminator is `noMetric` (set only when the configured
 * instance is missing or doesn't match the contract).
 */
function emptyAoiStreamResult(noMetric = false): AoiStreamPlotResult {
  return {
    series: [],
    timeline: createAdaptiveTimeline(0, 100, 6),
    binCount: 0,
    windowSize: 0,
    stepSize: 0,
    maxTime: 0,
    participants: 0,
    maxTotal: 0,
    maxValue: 0,
    yAxisLabel: '',
    unit: '',
    windowLabel: '',
    ...(noMetric ? { noMetric: true as const } : {}),
  }
}

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
    'stimulusId' | 'groupId' | 'metricInstanceIds' | 'hideNoAoi'
  > & {
    timelineMin?: number
    timelineMax?: number
    /**
     * Display budget: the most windows to evaluate/draw. Honors `stepSize` by
     * drawing every Nth configured window (`N = ceil(W / maxColumns)`) — each
     * drawn window is a real configured-step window, so a sub-pixel step is not
     * fabricated, only down-sampled to what the screen can show. Defaults to
     * {@link DEFAULT_MAX_COLUMNS}.
     */
    maxColumns?: number
  }
): AoiStreamPlotResult {
  const meta = engine.metadata
  if (!meta) return emptyAoiStreamResult()

  const resolved = resolveMetric({
    instances: meta.metricInstances,
    id: settings.metricInstanceIds?.[0] ?? null,
    contract: CONTRACT,
  })
  if (!resolved.ok) return emptyAoiStreamResult(true)

  const { instance, window } = resolved
  const { windowSize, stepSize } = window
  if (!Number.isFinite(windowSize) || windowSize <= 0) return emptyAoiStreamResult(true)
  if (!Number.isFinite(stepSize) || stepSize <= 0) return emptyAoiStreamResult(true)

  const { stimulusId, groupId } = settings
  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  if (participantIds.length === 0) return emptyAoiStreamResult()

  let maxTime = 0
  for (let i = 0; i < participantIds.length; i++) {
    const t = getParticipantEndTime(engine, stimulusId, participantIds[i])
    if (t > maxTime) maxTime = t
  }
  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const timeStart = timelineMin
  const timeEnd = Math.max(timelineMin + windowSize, timelineMax)

  // Honor windowSize + stepSize, but never compute more windows than the display
  // can show. `fullW` is the configured-step window count; `stride` is how many
  // configured windows fall between drawn columns, so `displayStep = stride ×
  // stepSize` and every drawn window is a real configured-step window
  // (`timeStart + i × displayStep` = configured position at step-index `i × stride`).
  const maxColumns = Math.max(1, Math.floor(settings.maxColumns ?? DEFAULT_MAX_COLUMNS))
  const fullW = Math.max(1, Math.floor((timeEnd - timeStart - windowSize) / stepSize) + 1)
  const stride = Math.max(1, Math.ceil(fullW / maxColumns))
  const displayStep = stride * stepSize

  const groupScope: GroupScope = {
    engine,
    stimulusId,
    participantIds,
    timeStart,
    timeEnd,
  }

  // Decimate by querying at the strided step. `displayStep` is an integer
  // multiple of the configured step, so the windows land on real configured
  // positions (every Nth window) — the step is honored, just sub-sampled to the
  // display. This drives the existing single-scan fan-out (`queryGroup`), which
  // resolves each fixation's AOI slots ONCE and dispatches to its windows, far
  // cheaper than re-resolving per drawn window. With `stride === 1` the step is
  // unchanged and this is the full-resolution path. Either way only ~maxColumns
  // windows are produced, so cost and memory stay bounded by the display.
  const effInstance =
    stride === 1
      ? instance
      : {
          ...instance,
          projection: {
            kind: 'windowed' as const,
            window: { windowSize, stepSize: displayStep },
            inner: (instance.projection as WindowedProjection).inner,
          },
        }
  const result = asAoiVectorTimeseries(queryGroup(effInstance, groupScope))
  if (!result) return emptyAoiStreamResult(true)

  // Reshape the library's per-window aoi-vectors into per-AOI time series.
  // `result.slots` is the authoritative slot layout — never reach into
  // vectors by hardcoded indices.
  const { noAoiSlot } = result.slots
  const aoiCount = noAoiSlot
  const hideNoAoi = settings.hideNoAoi ?? false
  const totalSlots = hideNoAoi ? aoiCount : aoiCount + 1 // AOI slots + the noAoi sentinel
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
    if (!hideNoAoi) {
      const noAoi = v[noAoiSlot]
      if (Number.isFinite(noAoi)) accums[noAoiSlot][w] = noAoi
    }
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
  if (!hideNoAoi) {
    series[aoiCount] = {
      id: -1,
      label: noAoiTreatment.displayedName,
      color: noAoiTreatment.color,
      values: accums[aoiCount],
    }
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
  // Bins are spaced by `displayStep` (the drawn windows). `windowLabel` below
  // still reports the configured `window` (real windowSize/stepSize).
  const plotRange = (binCount - 1) * displayStep + windowSize
  const plotStart = timelineMin
  const plotEnd = plotStart + plotRange

  const metric = getMetric(instance.baseId)
  return {
    series,
    timeline: createAdaptiveTimeline(plotStart, plotEnd, 6),
    binCount,
    windowSize,
    // Reported step is the on-screen bin spacing (`displayStep`), which the
    // layout and tooltip use as `binIndex × stepSize`. Equals the configured
    // step when no down-sampling occurs (stride 1).
    stepSize: displayStep,
    maxTime: plotEnd,
    participants: participantIds.length,
    maxTotal,
    maxValue,
    // Time-axis plot: quantity + param qualifiers, NO projection (the window
    // lives on the x axis). Respects a renamed instance.
    yAxisLabel: buildMetricLabel(instance, metric),
    unit: metric?.meta.unit ?? '',
    windowLabel: windowLabel(window, metric?.meta.windowUnit ?? 'ms'),
  }
}
