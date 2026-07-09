import { getParticipant, getSegment } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Pure content builder for the scarf segment tooltip. The figure's `hitTest`
 * embeds this into its `FrameHit`; the `usePlot` harness owns showing,
 * positioning, and hiding — same contract as every other plot.
 */
export const buildScarfTooltipContent = (
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  segmentId: number
): Array<{ key: string; value: string }> => {
  const segment = getSegment(engine, stimulusId, participantId, segmentId)
  const content: Array<{ key: string; value: string }> = [
    {
      key: 'Participant',
      value: getParticipant(engine, participantId).displayedName,
    },
    { key: 'Category', value: segment.category.displayedName },
  ]
  if (segment.category.id === FIXATION_CATEGORY_ID) {
    content.push({
      key: 'AOI',
      value:
        segment.aoi.length > 0
          ? segment.aoi.map(aoi => aoi.displayedName).join(', ')
          : 'None',
    })
  }
  content.push(
    { key: 'Order index', value: segmentId.toString() },
    { key: 'Start', value: segment.start.toFixed(1) },
    { key: 'End', value: segment.end.toFixed(1) },
    { key: 'Duration', value: (segment.end - segment.start).toFixed(1) }
  )
  return content
}
