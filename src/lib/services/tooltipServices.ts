import { getParticipant, getSegment } from '$lib/stores/dataStore'
import { tooltipStore } from '$lib/stores/tooltipStore'
import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType'

/**
 * Service function to fill the tooltip with data.
 * Updates the tooltip store with the provided data.
 * @param filling data to fill the tooltip with
 * @returns void
 */
export const tooltipScarfService = (
  filling: ScarfTooltipFillingType | null
) => {
  if (filling === null) {
    tooltipStore.set(null)
    return
  }
  const segment = getSegment(
    filling.stimulusId,
    filling.participantId,
    filling.segmentId
  )
  const aoi =
    segment.aoi.length > 0
      ? segment.aoi.map(aoi => aoi.displayedName).join(', ')
      : 'None'
  const content: Array<{ key: string; value: string }> = [
    {
      key: 'Participant',
      value: getParticipant(filling.participantId).displayedName,
    },
    { key: 'Category', value: segment.category.displayedName },
  ]
  if (segment.category.displayedName === 'Fixation') {
    content.push({ key: 'AOI', value: aoi })
  }
  const start = segment.start.toFixed(1)
  const end = segment.end.toFixed(1)
  const duration = (segment.end - segment.start).toFixed(1)
  content.push(
    { key: 'Order index', value: filling.segmentId.toString() },
    { key: 'Start', value: start.toString() },
    { key: 'End', value: end.toString() },
    { key: 'Duration', value: duration.toString() }
  )

  tooltipStore.set({
    visible: true,
    content,
    x: filling.x,
    y: filling.y,
    width: filling.width,
  })
}
