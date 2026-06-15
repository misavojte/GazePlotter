import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import {
  asAoiVector,
  createAdaptiveTimeline,
  resolveMetric,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import {
  formatDecimal,
} from '$lib/shared/utils/mathUtils'
import type {
  BarPlotResult,
  BarPlotDataItem,
  BarPlotSettings,
  AoiSummaryStatistics,
} from '../types'
import {
  query,
  queryIndividuals,
  getMetric,
  type MetricInstance,
  type PlotMetricContract,
  type Scope,
} from '$lib/metrics'

const CONTRACT = { outputShape: 'aoi-vector', windowing: 'forbidden' } as const satisfies PlotMetricContract

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
  >
): BarPlotResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  const aois = getAois(engine, settings.stimulusId)
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
  // A `proportion`-aggregated metric (e.g. `fixated`) is a [0,1] rate: render it
  // as a plain proportional bar (value as percent), not a beeswarm of 0/1 dots.
  const isProportion = getMetric(instance.baseId)?.meta.groupAggregation === 'proportion'

  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0
  const hideNoAoi = settings.hideNoAoi ?? false
  const totalSlots = hideNoAoi ? aois.length : aois.length + 1

  const participantDisplayNames = participantIds.map(id => {
    const pData = meta.participants.data[id]
    return pData?.[1] ?? pData?.[0] ?? `P${id}`
  })

  const individualArrays = new Array<number[]>(totalSlots)
  const individualNameArrays = new Array<string[]>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    const result = extractIndividualValuesWithIdentity(
      engine,
      instance,
      settings.stimulusId,
      participantIds,
      i,
      timeStart,
      timeEnd,
      participantDisplayNames
    )
    individualArrays[i] = result.values
    individualNameArrays[i] = result.names
  }

  const statsArrays = new Array<AoiSummaryStatistics>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    statsArrays[i] = computeSummaryStatistics(individualArrays[i])
  }

  // Proportion metrics are displayed as percent: the bar value is scaled to [0,100]
  // so the existing numeric axis and `%` label read correctly. Other metrics keep
  // their native value (mean of individuals). Rendered as plain descriptive bars —
  // no confidence band (see drawProportionalBars for why).
  const rawData = new Array<number>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    rawData[i] = isProportion ? statsArrays[i].mean * 100 : statsArrays[i].mean
  }

  const labeledData = createLabeledData(
    rawData,
    aois,
    meta.noAoiTreatment,
    instance,
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

  let timelineMin = 0
  let timelineMax = dataMax || 100
  if (settings.scaleRange) {
    if (settings.scaleRange[0] !== 0) timelineMin = settings.scaleRange[0]
    if (settings.scaleRange[1] !== 0) timelineMax = settings.scaleRange[1]
  }
  if (timelineMax <= timelineMin) timelineMax = timelineMin + 1
  const timeline = createAdaptiveTimeline(timelineMin, timelineMax, 6)

  return {
    data: sortedData,
    timeline,
    dataMax,
    proportion: isProportion,
  }
}

function extractIndividualValuesWithIdentity(
  engine: DataEngine,
  instance: MetricInstance,
  stimulusId: number,
  participantIds: number[],
  aoiIndex: number,
  timeStart: number,
  timeEnd: number,
  participantNames: string[]
): { values: number[]; names: string[] } {
  if (participantIds.length === 0) return { values: [], names: [] }

  const values: number[] = []
  const names: string[] = []

  for (let p = 0; p < participantIds.length; p++) {
    const scope: Scope = {
      engine, stimulusId, participantId: participantIds[p],
      timeStart, timeEnd,
    }
    const individuals = queryIndividuals(instance, scope, aoiIndex)
    const expanded = individuals.length > 0
      ? individuals
      : [asAoiVector(query(instance, scope))?.values[aoiIndex] ?? Number.NaN]
    for (const v of expanded) {
      if (Number.isFinite(v)) {
        values.push(v)
        names.push(participantNames[p])
      }
    }
  }
  return { values, names }
}

function createLabeledData(
  rawData: number[],
  aois: readonly ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
  instance: MetricInstance,
  individualArrays: number[][] | null = null,
  statsArrays: AoiSummaryStatistics[] | null = null,
  individualNameArrays: string[][] | null = null
): BarPlotDataItem[] {
  const result: BarPlotDataItem[] = new Array(rawData.length)
  const isTimeToFirstFixation = instance.baseId === 'timeToFirstFixation'

  for (let i = 0; i < rawData.length; i++) {
    const value = rawData[i]
    const isNoAoi = i === aois.length
    const label = isNoAoi ? noAoiTreatment.displayedName : aois[i].displayedName
    const color = isNoAoi ? noAoiTreatment.color : aois[i].color

    const formattedValue =
      isTimeToFirstFixation && value === 0 ? 0 : formatDecimal(value)

    result[i] = {
      value: formattedValue,
      label,
      color,
      stats: statsArrays ? statsArrays[i] : null,
      individualValues: individualArrays ? individualArrays[i] : null,
      individualParticipantNames: individualNameArrays ? individualNameArrays[i] : null,
    }
  }

  return result
}

function applySorting(
  data: BarPlotDataItem[],
  orderBy: 'value' | 'aoi',
  orderDirection: 'asc' | 'desc'
): BarPlotDataItem[] {
  const sorted = [...data]

  if (orderBy === 'aoi') {
    return orderDirection === 'asc' ? data : sorted.reverse()
  }

  return sorted.sort((a, b) =>
    orderDirection === 'asc' ? a.value - b.value : b.value - a.value
  )
}

function computeSummaryStatistics(
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

  const q1 = percentile(sorted, 0.25)
  const q3 = percentile(sorted, 0.75)

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

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}
