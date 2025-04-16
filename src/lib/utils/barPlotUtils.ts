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
  const NO_AOI_COLOR = '#888888' // Gray color for segments without AOI hits

  // Calculate bar plot data
  const participants = getParticipants(settings.groupId, settings.stimulusId)
  const segments = participants.flatMap(
    participant => getSegments(settings.stimulusId, participant.id, [0]) // [0] is the category for fixation
  )

  // Calculate total fixation time for segments without AOIs
  const noAoiSegments = segments.filter(segment => segment.aoi.length === 0)
  const noAoiTotalTime = noAoiSegments.reduce(
    (sum, segment) => sum + segment.end - segment.start,
    0
  )

  // Calculate times for each AOI
  const aoisSumTimes = aois.map(iteratedAoi => {
    const aoiSegments = segments.filter(segment =>
      segment.aoi.some(aoi => aoi.id === iteratedAoi.id)
    )
    return aoiSegments.reduce(
      (sum, segment) => sum + segment.end - segment.start,
      0
    )
  })

  // Add the "No AOI Hit" time to the array
  const allTimes = [...aoisSumTimes, noAoiTotalTime]

  // For relative time calculation, we need the total fixation time across all AOIs
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'
  let processedData = [...allTimes]

  if (aggregationMethod === 'relativeTime') {
    // Calculate total fixation time across all AOIs and no-AOI segments
    const totalFixationTime = allTimes.reduce((sum, time) => sum + time, 0)

    // Convert to percentages (0-100) where sum equals 100%
    processedData = allTimes.map(time =>
      totalFixationTime > 0 ? (time / totalFixationTime) * 100 : 0
    )
  }

  const maxValue = Math.max(...processedData)

  // Create data items with label and color
  let labeledData = processedData.map((value, index) => {
    // If this is the last item (No AOI Hit)
    if (index === aois.length) {
      return {
        value: Number(value.toFixed(1)),
        label: 'No AOI',
        color: NO_AOI_COLOR,
      }
    }
    // Regular AOI
    return {
      value: Number(value.toFixed(1)),
      label: aois[index].displayedName,
      color: aois[index].color,
    }
  })

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
