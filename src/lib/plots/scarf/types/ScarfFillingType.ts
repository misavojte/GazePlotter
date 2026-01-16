import { AdaptiveTimeline } from '../../shared/class/AdaptiveTimeline'
import type { StimulusScarfFillingType } from './StimulusScarfFilling/StimulusScarfFillingType'
import type { StylingScarfFillingType } from './StylingScarfFilling/StylingScarfFillingType'
import type { ParticipantScarfFillingType } from './ParticipantScarfFilling/ParticipantScarfFillingType'

/**
 * Object that contains all information needed to draw a scarf plot for a single stimulus.
 * It is generated from raw const and scarf settings (height of bars etc.) by ScarfService.
 * Raw const are too complicated to be used directly in the scarf component.
 *
 * @param stimulusId - ID of the stimulus to be plotted
 * @param timeline - AdaptiveTimeline object containing information about the timeline ticks and bounds
 * @param stylingAndLegend - ScarfStylingList object containing information about the styling of the scarf plot
 * @param barHeight - height of the bar representing a single participant
 * @param heightOfBarWrap - height of the bar with all the elements (participant bar, aoi bars, non-fixation bars)
 * @param chartHeight - height of the whole chart
 * @param participants - array of ScarfParticipant objects containing information about participants
 * @param stimuli - array of ScarfStimuliInfo objects containing information about stimuli (for stimuli selection)
 */
export type ScarfFillingType = {
  id: number
  timelineType: string
  barHeight: number
  stimulusId: number
  heightOfBarWrap: number
  chartHeight: number
  stimuli: StimulusScarfFillingType[]
  participants: ParticipantScarfFillingType[]
  timeline: AdaptiveTimeline
  stylingAndLegend: StylingScarfFillingType
  /**
   * Precomputed layout widths used by the renderer.
   * These must match the values used when constructing the visual buffers.
   */
  leftLabelWidth: number
  plotAreaWidth: number

  /**
   * Precomputed visual buffers (pixel coordinates) for canvas rendering.
   * Each array corresponds to one style index (bucketed by style during transformation).
   * This eliminates the need for runtime bucketing in Svelte.
   *
   * Rectangle buffer layout per style (RECT_STRIDE = 8):
   * [x, y, width, height, participantId, segmentId, orderId, reserved0]
   *
   * Line buffer layout per style (LINE_STRIDE = 6):
   * [x1, y1, x2, y2, participantId, reserved0]
   */
  visualRectBuckets: Float32Array[]
  visualLineBuckets: Float32Array[]
}
