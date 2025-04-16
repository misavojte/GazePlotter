import { getAois, getParticipants, getSegments } from '$lib/stores/dataStore'
import { AdaptiveTimeline } from '$lib/class/Plot/AdaptiveTimeline/AdaptiveTimeline'
import type { BarPlotGridType } from '$lib/type/gridType'

export interface BarPlotDataItem {
  value: number
  label: string
  color: string
}

export function getBarPlotData(
  settings: Pick<
    BarPlotGridType,
    'stimulusId' | 'groupId' | 'aggregationMethod' | 'sortBars'
  >
) {
  const aois = getAois(settings.stimulusId)

  // Calculate bar plot data
  const participants = getParticipants(settings.groupId, settings.stimulusId)
  const segments = participants.flatMap(
    participant => getSegments(settings.stimulusId, participant.id, [0]) // [0] is the category for fixation
  )

  const aoisSumTimes = aois.map(iteratedAoi => {
    const aoiSegments = segments.filter(segment =>
      segment.aoi.some(aoi => aoi.id === iteratedAoi.id)
    )
    return aoiSegments.reduce(
      (sum, segment) => sum + segment.end - segment.start,
      0
    )
  })

  // For relative time calculation, we need the total fixation time across all AOIs
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'
  let processedData = [...aoisSumTimes]

  if (aggregationMethod === 'relativeTime') {
    // Calculate total fixation time across all AOIs
    const totalFixationTime = aoisSumTimes.reduce((sum, time) => sum + time, 0)

    // Convert to percentages (0-100) where sum of all AOIs equals 100%
    processedData = aoisSumTimes.map(time =>
      totalFixationTime > 0 ? (time / totalFixationTime) * 100 : 0
    )
  }

  const maxValue = Math.max(...processedData)

  // Create data items with label and color
  let labeledData = processedData.map((value, index) => ({
    value: Number(value.toFixed(1)),
    label: aois[index].displayedName,
    color: aois[index].color,
  }))

  // Sort the data based on sortBars setting
  const sortBars = settings.sortBars || 'none'
  if (sortBars !== 'none') {
    labeledData = [...labeledData].sort((a, b) => {
      if (sortBars === 'ascending') {
        return a.value - b.value
      } else {
        return b.value - a.value
      }
    })
  }

  const timeline = new AdaptiveTimeline(0, maxValue, 6)

  return {
    data: labeledData,
    timeline,
  }
}
