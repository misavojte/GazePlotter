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
    'stimulusId' | 'groupId' | 'aggregationMethod'
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

  // For relative time calculation, we need the mean experiment duration
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'
  let processedData = [...aoisSumTimes]

  if (aggregationMethod === 'relativeTime') {
    // Calculate total experiment duration for each participant
    const participantDurations = participants.map(participant => {
      // Get segments for this specific participant
      const participantSegments = getSegments(
        settings.stimulusId,
        participant.id,
        [0]
      )

      // Find the latest end time to determine experiment duration
      return participantSegments.length
        ? Math.max(...participantSegments.map(s => s.end))
        : 0
    })

    // Calculate mean experiment duration
    const meanDuration = participantDurations.length
      ? participantDurations.reduce((sum, duration) => sum + duration, 0) /
        participantDurations.length
      : 1 // Avoid division by zero

    // Convert to percentages (0-100)
    processedData = aoisSumTimes.map(time => (time / meanDuration) * 100)
  }

  const maxValue = Math.max(...processedData)

  const labeledData = processedData.map((value, index) => ({
    value: Number(value.toFixed(1)),
    label: aois[index].displayedName,
    color: aois[index].color,
  }))

  const timeline = new AdaptiveTimeline(0, maxValue, 5)

  return {
    data: labeledData,
    timeline,
  }
}
