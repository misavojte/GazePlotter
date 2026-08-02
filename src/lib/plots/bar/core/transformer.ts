import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois, getParticipantsIds, getParticipant } from '$lib/data/engine'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import {
  createAdaptiveTimeline,
  resolveMetric,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import {
  formatDecimal,
  percentileSorted,
} from '$lib/shared/utils/mathUtils'
import type {
  BarPlotResult,
  BarPlotDataItem,
  BarPlotSettings,
  AoiSummaryStatistics,
} from '../types'
import {
  queryPooledIndividuals,
  getMetric,
  type PlotMetricContract,
} from '$lib/metrics'

const CONTRACT = { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' } as const satisfies PlotMetricContract

export function getBarPlotData(
  engine: DataEngine,
  settings: Pick<
    BarPlotSettings,
    | 'stimulusId'
    | 'groupId'
    | 'metricInstanceIds'
    | 'orderBy'
    | 'orderDirection'
    | 'scaleRange'
    | 'timelineStart'
    | 'timelineEnd'
    | 'statisticalOverlay'
    | 'hideNoAoi'
    | 'aoiSelectionId'
  >
): BarPlotResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  const aois = getAois(engine, settings.stimulusId, settings.aoiSelectionId)
  const participantIds = getParticipantsIds(
    engine,
    settings.groupId,
    settings.stimulusId
  )
  const overlay = settings.statisticalOverlay ?? 'none'

  const resolved = resolveMetric({
    instances: meta.metricInstances,
    id: settings.metricInstanceIds?.[0] ?? null,
    contract: CONTRACT,
  })
  if (!resolved.ok) {
    return { data: [], timeline: createAdaptiveTimeline(0, 100, 6), dataMax: 0, noMetric: true }
  }
  if (participantIds.length === 0) {
    return { data: [], timeline: createAdaptiveTimeline(0, 100, 6), dataMax: 0 }
  }
  const { instance } = resolved
  // A `proportion`-class metric (e.g. `fixated`) is a [0,1] rate: render it as a
  // plain proportional bar (value as percent), not a beeswarm of 0/1 dots.
  const isProportion = getMetric(instance.baseId)?.meta.measurementClass === 'proportion'

  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0
  const hideNoAoi = settings.hideNoAoi ?? false
  const totalSlots = hideNoAoi ? aois.length : aois.length + 1

  const participantDisplayNames = participantIds.map(
    id => getParticipant(engine, id).displayedName
  )

  // The shared beeswarm-pooling rule (see queryPooledIndividuals): one scan per
  // participant, every event its own dot for metrics with an `individuals`
  // recipe, per-slot fallback to the cached aggregate for the rest.
  const { values: individualArrays, names: individualNameArrays } = queryPooledIndividuals(
    instance,
    participantIds.map(participantId => ({
      engine, stimulusId: settings.stimulusId, participantId,
      timeStart, timeEnd, aoiSelectionId: settings.aoiSelectionId,
    })),
    participantDisplayNames,
    Array.from({ length: totalSlots }, (_, s) => s)
  )

  const statsArrays = new Array<AoiSummaryStatistics>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    statsArrays[i] = computeSummaryStatistics(individualArrays[i])
  }

  // Every metric's values match its declared unit (fixated emits 0/100 for
  // `%`), so the bar value is always the plain mean of individuals — no
  // per-class scaling. Proportion metrics still render as plain descriptive
  // bars, no confidence band (see drawProportionalBars for why).
  const rawData = new Array<number>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    rawData[i] = statsArrays[i].mean
  }

  const labeledData = createLabeledData(
    rawData,
    aois,
    meta.noAoiTreatment,
    individualArrays,
    statsArrays,
    individualNameArrays
  )

  const sortedData = applySorting(
    labeledData,
    settings.orderBy || 'aoi',
    settings.orderDirection || 'asc'
  )

  let dataMax = 0
  if (isProportion) {
    // Percent bar values; the axis is data-driven (space-efficient).
    for (let i = 0; i < totalSlots; i++) {
      if (rawData[i] > dataMax) dataMax = rawData[i]
    }
  } else {
    for (let i = 0; i < individualArrays.length; i++) {
      const vals = individualArrays[i]
      for (let j = 0; j < vals.length; j++) {
        if (vals[j] > dataMax) dataMax = vals[j]
      }
    }
    if (overlay === 'boxplot') {
      for (let i = 0; i < statsArrays.length; i++) {
        if (statsArrays[i].whiskerHigh > dataMax) dataMax = statsArrays[i].whiskerHigh
      }
    }
  }

  const timeline = valueAxisTimeline(dataMax, settings.scaleRange)

  return {
    data: sortedData,
    timeline,
    dataMax,
    proportion: isProportion,
  }
}

function createLabeledData(
  rawData: number[],
  aois: readonly ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
  individualArrays: number[][] | null = null,
  statsArrays: AoiSummaryStatistics[] | null = null,
  individualNameArrays: string[][] | null = null
): BarPlotDataItem[] {
  const result: BarPlotDataItem[] = new Array(rawData.length)

  for (let i = 0; i < rawData.length; i++) {
    const value = rawData[i]
    const isNoAoi = i === aois.length
    const label = isNoAoi ? noAoiTreatment.displayedName : aois[i].displayedName
    const color = isNoAoi ? noAoiTreatment.color : aois[i].color

    result[i] = {
      value: formatDecimal(value),
      label,
      color,
      stats: statsArrays ? statsArrays[i] : null,
      individualValues: individualArrays ? individualArrays[i] : null,
      individualParticipantNames: individualNameArrays ? individualNameArrays[i] : null,
    }
  }

  return result
}

/**
 * One sort policy for every plot rendering through `BarPlotFigure` (exported
 * for the eye-movement comparison). Any `orderBy` other than `'value'` keeps
 * the given order ('aoi', 'type', ...), reversed for desc.
 */
export function applySorting(
  data: BarPlotDataItem[],
  orderBy: 'value' | (string & {}),
  orderDirection: 'asc' | 'desc'
): BarPlotDataItem[] {
  if (orderBy !== 'value') {
    return orderDirection === 'asc' ? data : [...data].reverse()
  }
  return [...data].sort((a, b) =>
    orderDirection === 'asc' ? a.value - b.value : b.value - a.value
  )
}

/**
 * The shared figure's value-axis policy — nice timeline from the data max,
 * with `scaleRange`'s zero-means-unset overrides and the +1 floor guard.
 * Exported for the eye-movement comparison so the two plots cannot drift on
 * scale semantics.
 */
export function valueAxisTimeline(
  dataMax: number,
  scaleRange: [number, number] | undefined
): AdaptiveTimeline {
  let timelineMin = 0
  let timelineMax = dataMax || 100
  if (scaleRange) {
    if (scaleRange[0] !== 0) timelineMin = scaleRange[0]
    if (scaleRange[1] !== 0) timelineMax = scaleRange[1]
  }
  if (timelineMax <= timelineMin) timelineMax = timelineMin + 1
  return createAdaptiveTimeline(timelineMin, timelineMax, 6)
}

/** Exported for the eye-movement comparison plot — same stats bundle, same figure. */
export function computeSummaryStatistics(
  values: number[]
): AoiSummaryStatistics {
  const empty: AoiSummaryStatistics = {
    mean: 0,
    median: 0,
    q1: 0,
    q3: 0,
    min: 0,
    max: 0,
    sd: 0,
    sem: 0,
    whiskerLow: 0,
    whiskerHigh: 0,
    count: 0,
    outliers: [],
  }

  if (values.length === 0) return empty

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  let sum = 0
  for (let i = 0; i < n; i++) sum += sorted[i]
  const mean = sum / n

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)]

  const q1 = percentileSorted(sorted, 0.25)
  const q3 = percentileSorted(sorted, 0.75)

  const min = sorted[0]
  const max = sorted[n - 1]

  let sumSqDiff = 0
  for (let i = 0; i < n; i++) {
    const diff = sorted[i] - mean
    sumSqDiff += diff * diff
  }
  const sd = n > 1 ? Math.sqrt(sumSqDiff / (n - 1)) : 0
  const sem = n > 0 ? sd / Math.sqrt(n) : 0

  const iqr = q3 - q1
  const whiskerLowBound = q1 - 1.5 * iqr
  const whiskerHighBound = q3 + 1.5 * iqr

  let whiskerLow = min
  for (let i = 0; i < n; i++) {
    if (sorted[i] >= whiskerLowBound) {
      whiskerLow = sorted[i]
      break
    }
  }

  let whiskerHigh = max
  for (let i = n - 1; i >= 0; i--) {
    if (sorted[i] <= whiskerHighBound) {
      whiskerHigh = sorted[i]
      break
    }
  }

  const outliers: number[] = []
  for (let i = 0; i < n; i++) {
    if (sorted[i] < whiskerLow || sorted[i] > whiskerHigh) {
      outliers.push(sorted[i])
    }
  }

  return {
    mean,
    median,
    q1,
    q3,
    min,
    max,
    sd,
    sem,
    whiskerLow,
    whiskerHigh,
    count: n,
    outliers,
  }
}
