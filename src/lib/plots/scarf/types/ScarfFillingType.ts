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
   *
   * Rectangle buffer layout (RECT_STRIDE = 12):
   * [x, y, width, height, identifierIndex, participantId, segmentId, orderId, reserved0, reserved1, reserved2, reserved3]
   *
   * Line buffer layout (LINE_STRIDE = 10):
   * [x1, y1, x2, y2, identifierIndex, participantId, reserved0, reserved1, reserved2, reserved3]
   */
  visualRectBuffer: Float32Array
  visualLineBuffer: Float32Array
}
