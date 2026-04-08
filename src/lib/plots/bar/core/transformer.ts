import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAoiRaw } from '$lib/data/engine/utils/interpreters'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import {
  formatDecimal,
  normalizeToPercentages,
} from '$lib/shared/utils/mathUtils'
import type {
  BarPlotResult,
  BarPlotDataItem,
  BarPlotSettings,
  AoiSummaryStatistics,
} from '../types'
import { collectParticipantBarMetrics } from './collector'

/**
 * Main function to get bar plot data based on selected settings.
 * Now uses a single pass collector for all participants.
 */
export function getBarPlotData(
  engine: DataEngine,
  settings: Pick<
    BarPlotSettings,
    | 'stimulusId'
    | 'groupId'
    | 'aggregationMethod'
    | 'orderBy'
    | 'orderDirection'
    | 'scaleRange'
    | 'timelineStart'
    | 'timelineEnd'
    | 'statisticalOverlay'
  >
): BarPlotResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  const aois = getVisibleAois(engine, settings.stimulusId)
  const participantIds = getParticipantIdsForGroup(
    engine,
    settings.groupId,
    settings.stimulusId
  )
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'
  const overlay = settings.statisticalOverlay ?? 'none'

  if (participantIds.length === 0) {
    return { data: [], timeline: createAdaptiveTimeline(0, 100, 6) }
  }

  // Single pass collection of all metrics for all participants
  const participantMetrics = collectParticipantBarMetrics(
    engine,
    settings.stimulusId,
    participantIds,
    aois,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0
  )

  const totalSlots = aois.length + 1

  // Resolve participant display names for identity tracking
  const participantDisplayNames = participantIds.map(id => {
    const pData = meta.participants.data[id]
    return pData?.[1] ?? pData?.[0] ?? `P${id}`
  })

  // Always extract individual values (beeswarm is always shown)
  const individualArrays = new Array<number[]>(totalSlots)
  const individualNameArrays = new Array<string[]>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    const result = extractIndividualValuesWithIdentity(
      participantMetrics,
      aggregationMethod,
      i,
      participantDisplayNames
    )
    individualArrays[i] = result.values
    individualNameArrays[i] = result.names
  }

  // Always compute statistics (needed for overlay and for the displayed value)
  const statsArrays = new Array<AoiSummaryStatistics>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    statsArrays[i] = computeSummaryStatistics(individualArrays[i])
  }

  // Use mean as the displayed value (individual data is primary)
  const rawData = new Array<number>(totalSlots)
  for (let i = 0; i < totalSlots; i++) {
    rawData[i] = statsArrays[i].mean
  }

  // Create labeled data with AOI information
  const labeledData = createLabeledData(
    rawData,
    aois,
    meta.noAoiTreatment,
    aggregationMethod,
    individualArrays,
    statsArrays,
    individualNameArrays
  )

  // Apply sorting if needed
  const sortedData = applySorting(
    labeledData,
    settings.orderBy || 'aoi',
    settings.orderDirection || 'asc'
  )

  // Determine max value for timeline from individual values
  let dataMax = 0
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

  // Create timeline with appropriate scale
  const timeline = createTimeline(rawData, settings.scaleRange, dataMax)

  return {
    data: sortedData,
    timeline,
  }
}

function getParticipantOrderVector(engine: DataEngine): number[] {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.participants.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.participants.data.length }, (_, i) => i)
  }
  return order
}

function getParticipantIdsForGroup(
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): number[] {
  const meta = engine.metadata
  const reader = engine.getReader()
  if (!meta || !reader) throw new Error('Data engine metadata not available')

  const participantOrder = getParticipantOrderVector(engine)
  if (groupId === -1) return participantOrder

  if (groupId === -2) {
    return participantOrder.filter(
      participantId => reader.getSegmentCount(stimulusId, participantId) > 0
    )
  }

  const group = meta.participantsGroups.find(candidate => candidate.id === groupId)
  if (!group && groupId === 0) return participantOrder
  if (!group) throw new Error(`Participants group with id ${groupId} does not exist`)
  return group.participantsIds
}

function getVisibleAois(
  engine: DataEngine,
  stimulusId: number
): ExtendedInterpretedDataType[] {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const stimulusAois = meta.aois.data[stimulusId]
  if (!stimulusAois) throw new Error(`AOI data for stimulus ${stimulusId} not found`)

  const order = meta.aois.orderVector?.[stimulusId]
  const ids =
    order == null || order.length === 0
      ? Array.from({ length: stimulusAois.length }, (_, i) => i)
      : order

  const hidden = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const uniqueMappedIds = new Set<number>()

  for (let i = 0; i < ids.length; i++) {
    const rawId = ids[i]
    if (hiddenSet?.has(rawId)) continue
    uniqueMappedIds.add(engine.getAoiMapping(stimulusId, rawId))
  }

  const aois: ExtendedInterpretedDataType[] = []
  for (const aoiId of uniqueMappedIds) {
    aois.push(getAoiRaw(stimulusId, aoiId, meta))
  }

  return aois
}

/**
 * Aggregates individual participant metrics into the final bar values.
 * Optimized for performance: avoids intermediate arrays and closures in hot loops.
 */
export function aggregateMetrics(
  metrics: ReturnType<typeof collectParticipantBarMetrics>,
  method: string,
  aoiCount: number
): number[] {
  const totalSlots = aoiCount + 1 // We only show up to No-AOI (exclude AnyFixation for now unless needed)
  const result = new Array(totalSlots).fill(0)
  const participantCount = metrics.length

  if (participantCount === 0) return result

  switch (method) {
    case 'absoluteTime':
    case 'relativeTime': {
      for (let p = 0; p < participantCount; p++) {
        const dwell = metrics[p].dwellTime
        for (let i = 0; i < totalSlots; i++) {
          result[i] += dwell[i]
        }
      }
      return method === 'relativeTime' ? normalizeToPercentages(result) : result
    }

    case 'timeToFirstFixation': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const val = metrics[p].ttff[i]
          if (val !== -1) {
            sum += val
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    case 'avgFixationDuration': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const durations = metrics[p].avgFixationDuration[i]
          for (let d = 0; d < durations.length; d++) {
            sum += durations[d]
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    case 'avgFirstFixationDuration': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const val = metrics[p].firstFixationDuration[i]
          if (val !== -1) {
            sum += val
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    case 'averageFixationCount': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        for (let p = 0; p < participantCount; p++) {
          sum += metrics[p].fixationCount[i]
        }
        result[i] = sum / participantCount
      }
      return result
    }

    case 'averageEntries': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        for (let p = 0; p < participantCount; p++) {
          sum += metrics[p].entryCount[i]
        }
        result[i] = sum / participantCount
      }
      return result
    }

    case 'avgDwellDuration': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const durations = metrics[p].dwellDurations[i]
          for (let d = 0; d < durations.length; d++) {
            sum += durations[d]
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    default:
      return result
  }
}

/**
 * Creates labeled data items from raw numeric values
 */
function createLabeledData(
  rawData: number[],
  aois: ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
  aggregationMethod: string,
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

    const formattedValue =
      aggregationMethod === 'timeToFirstFixation' && value === 0
        ? 0
        : formatDecimal(value)

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

/**
 * Applies sorting to labeled data based on user selection
 */
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

/**
 * Creates a timeline with appropriate scale based on data and user settings
 */
function createTimeline(
  rawData: number[],
  scaleRange?: [number, number],
  dataMaxOverride?: number
): AdaptiveTimeline {
  let maxValue = 0
  let hasData = false

  for (let i = 0; i < rawData.length; i++) {
    const val = rawData[i]
    if (!isNaN(val)) {
      if (val > maxValue) {
        maxValue = val
      }
      hasData = true
    }
  }

  // Use the override if it's larger (accounts for whiskers/individual values)
  if (dataMaxOverride !== undefined && dataMaxOverride > maxValue) {
    maxValue = dataMaxOverride
    hasData = true
  }

  // Handle empty or invalid data
  if (!hasData) {
    return createAdaptiveTimeline(0, 100, 6)
  }

  let min = 0
  let max = maxValue

  const hasCustomScale =
    scaleRange && (scaleRange[0] !== 0 || scaleRange[1] !== 0)

  if (scaleRange) {
    if (scaleRange[0] !== 0) min = scaleRange[0]
    if (scaleRange[1] !== 0) max = scaleRange[1]
  }

  // Ensure min < max
  if (max <= min) {
    max = min + 1
  }

  // If we are in "Auto" mode (no custom scale range), use nice max rounding
  // so bars have some breathing room.
  return createAdaptiveTimeline(min, max, 6, !hasCustomScale)
}

/**
 * Extracts individual values for a specific AOI slot from all participants.
 * Returns an array of values suitable for beeswarm overlay or statistics computation.
 */
export function extractIndividualValues(
  metrics: ReturnType<typeof collectParticipantBarMetrics>,
  method: string,
  aoiIndex: number
): number[] {
  const participantCount = metrics.length
  if (participantCount === 0) return []

  switch (method) {
    case 'absoluteTime': {
      const values: number[] = new Array(participantCount)
      for (let p = 0; p < participantCount; p++) {
        values[p] = metrics[p].dwellTime[aoiIndex]
      }
      return values
    }

    case 'relativeTime': {
      const values: number[] = []
      for (let p = 0; p < participantCount; p++) {
        const dwell = metrics[p].dwellTime
        let total = 0
        for (let i = 0; i < dwell.length; i++) total += dwell[i]
        // Each participant's relative value for this AOI
        values.push(total > 0 ? (dwell[aoiIndex] / total) * 100 : 0)
      }
      return values
    }

    case 'averageEntries': {
      const values: number[] = new Array(participantCount)
      for (let p = 0; p < participantCount; p++) {
        values[p] = metrics[p].entryCount[aoiIndex]
      }
      return values
    }

    case 'avgDwellDuration': {
      const values: number[] = []
      for (let p = 0; p < participantCount; p++) {
        const durations = metrics[p].dwellDurations[aoiIndex]
        for (let d = 0; d < durations.length; d++) {
          values.push(durations[d])
        }
      }
      return values
    }

    case 'averageFixationCount': {
      const values: number[] = new Array(participantCount)
      for (let p = 0; p < participantCount; p++) {
        values[p] = metrics[p].fixationCount[aoiIndex]
      }
      return values
    }

    case 'avgFixationDuration': {
      const values: number[] = []
      for (let p = 0; p < participantCount; p++) {
        const durations = metrics[p].avgFixationDuration[aoiIndex]
        for (let d = 0; d < durations.length; d++) {
          values.push(durations[d])
        }
      }
      return values
    }

    case 'timeToFirstFixation': {
      const values: number[] = []
      for (let p = 0; p < participantCount; p++) {
        const val = metrics[p].ttff[aoiIndex]
        if (val !== -1) values.push(val)
      }
      return values
    }

    case 'avgFirstFixationDuration': {
      const values: number[] = []
      for (let p = 0; p < participantCount; p++) {
        const val = metrics[p].firstFixationDuration[aoiIndex]
        if (val !== -1) values.push(val)
      }
      return values
    }

    default:
      return []
  }
}

/**
 * Extracts individual values with parallel participant name tracking.
 * Returns values and names arrays of the same length.
 */
function extractIndividualValuesWithIdentity(
  metrics: ReturnType<typeof collectParticipantBarMetrics>,
  method: string,
  aoiIndex: number,
  participantNames: string[]
): { values: number[]; names: string[] } {
  const participantCount = metrics.length
  if (participantCount === 0) return { values: [], names: [] }

  switch (method) {
    case 'absoluteTime': {
      const values = new Array<number>(participantCount)
      const names = new Array<string>(participantCount)
      for (let p = 0; p < participantCount; p++) {
        values[p] = metrics[p].dwellTime[aoiIndex]
        names[p] = participantNames[p]
      }
      return { values, names }
    }

    case 'relativeTime': {
      const values: number[] = []
      const names: string[] = []
      for (let p = 0; p < participantCount; p++) {
        const dwell = metrics[p].dwellTime
        let total = 0
        for (let i = 0; i < dwell.length; i++) total += dwell[i]
        values.push(total > 0 ? (dwell[aoiIndex] / total) * 100 : 0)
        names.push(participantNames[p])
      }
      return { values, names }
    }

    case 'averageEntries': {
      const values = new Array<number>(participantCount)
      const names = new Array<string>(participantCount)
      for (let p = 0; p < participantCount; p++) {
        values[p] = metrics[p].entryCount[aoiIndex]
        names[p] = participantNames[p]
      }
      return { values, names }
    }

    case 'avgDwellDuration': {
      const values: number[] = []
      const names: string[] = []
      for (let p = 0; p < participantCount; p++) {
        const durations = metrics[p].dwellDurations[aoiIndex]
        for (let d = 0; d < durations.length; d++) {
          values.push(durations[d])
          names.push(participantNames[p])
        }
      }
      return { values, names }
    }

    case 'averageFixationCount': {
      const values = new Array<number>(participantCount)
      const names = new Array<string>(participantCount)
      for (let p = 0; p < participantCount; p++) {
        values[p] = metrics[p].fixationCount[aoiIndex]
        names[p] = participantNames[p]
      }
      return { values, names }
    }

    case 'avgFixationDuration': {
      const values: number[] = []
      const names: string[] = []
      for (let p = 0; p < participantCount; p++) {
        const durations = metrics[p].avgFixationDuration[aoiIndex]
        for (let d = 0; d < durations.length; d++) {
          values.push(durations[d])
          names.push(participantNames[p])
        }
      }
      return { values, names }
    }

    case 'timeToFirstFixation': {
      const values: number[] = []
      const names: string[] = []
      for (let p = 0; p < participantCount; p++) {
        const val = metrics[p].ttff[aoiIndex]
        if (val !== -1) {
          values.push(val)
          names.push(participantNames[p])
        }
      }
      return { values, names }
    }

    case 'avgFirstFixationDuration': {
      const values: number[] = []
      const names: string[] = []
      for (let p = 0; p < participantCount; p++) {
        const val = metrics[p].firstFixationDuration[aoiIndex]
        if (val !== -1) {
          values.push(val)
          names.push(participantNames[p])
        }
      }
      return { values, names }
    }

    default:
      return { values: [], names: [] }
  }
}

/**
 * Computes summary statistics from an array of individual values.
 * Uses Tukey's method for whiskers (1.5×IQR).
 */
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

  // Mean
  let sum = 0
  for (let i = 0; i < n; i++) sum += sorted[i]
  const mean = sum / n

  // Median
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)]

  // Quartiles (using inclusive method)
  const q1 = percentile(sorted, 0.25)
  const q3 = percentile(sorted, 0.75)

  const min = sorted[0]
  const max = sorted[n - 1]

  // Standard deviation
  let sumSqDiff = 0
  for (let i = 0; i < n; i++) {
    const diff = sorted[i] - mean
    sumSqDiff += diff * diff
  }
  const sd = n > 1 ? Math.sqrt(sumSqDiff / (n - 1)) : 0
  const sem = n > 0 ? sd / Math.sqrt(n) : 0

  // Tukey whiskers (1.5×IQR)
  const iqr = q3 - q1
  const whiskerLowBound = q1 - 1.5 * iqr
  const whiskerHighBound = q3 + 1.5 * iqr

  // Whisker low = smallest value >= whiskerLowBound
  let whiskerLow = min
  for (let i = 0; i < n; i++) {
    if (sorted[i] >= whiskerLowBound) {
      whiskerLow = sorted[i]
      break
    }
  }

  // Whisker high = largest value <= whiskerHighBound
  let whiskerHigh = max
  for (let i = n - 1; i >= 0; i--) {
    if (sorted[i] <= whiskerHighBound) {
      whiskerHigh = sorted[i]
      break
    }
  }

  // Outliers = values beyond whiskers
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

/**
 * Computes a percentile from a sorted array using linear interpolation.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}
