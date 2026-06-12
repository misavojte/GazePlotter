import { getParticipant, getSegment } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { updateTooltip } from '$lib/tooltip'
import type { ScarfTooltipData } from '$lib/plots/scarf/types'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Service function to fill the tooltip with data.
 * Updates the tooltip store with the provided data.
 * @param filling data to fill the tooltip with
 * @returns void
 */
export const tooltipScarfService = (
  engine: DataEngine,
  filling: ScarfTooltipData | null
) => {
  if (filling === null) {
    updateTooltip(null)
    return
  }
  const segment = getSegment(
    engine,
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
      value: getParticipant(engine, filling.participantId).displayedName,
    },
    { key: 'Category', value: segment.category.displayedName },
  ]
  if (segment.category.id === FIXATION_CATEGORY_ID) {
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

  updateTooltip({
    id: 'scarf-segment-tooltip',
    visible: true,
    content,
    x: filling.x,
    y: filling.y,
    width: filling.width,
  })
}
