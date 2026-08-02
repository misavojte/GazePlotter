import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois, getParticipantsIds, getParticipant } from '$lib/data/engine'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { createAdaptiveTimeline, resolveMetric } from '$lib/plots/shared'
import {
  applySorting,
  computeSummaryStatistics,
  valueAxisTimeline,
  type CategoryDistribution,
  type DistributionResult,
  type SummaryStatistics,
} from '$lib/plots/shared/distribution'
import { formatDecimal } from '$lib/shared/utils/mathUtils'
import type { AoiComparisonSettings } from '../types'
import {
  queryPooledIndividuals,
  getMetric,
  type PlotMetricContract,
} from '$lib/metrics'

const CONTRACT = { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' } as const satisfies PlotMetricContract

export function getAoiComparisonData(
  engine: DataEngine,
  settings: Pick<
    AoiComparisonSettings,
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
): DistributionResult {
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

  const statsArrays = new Array<SummaryStatistics>(totalSlots)
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
  statsArrays: SummaryStatistics[] | null = null,
  individualNameArrays: string[][] | null = null
): CategoryDistribution[] {
  const result: CategoryDistribution[] = new Array(rawData.length)

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
