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
  /** End time per participant (ms), aligned with participants array. */
  participantEndTimes: Float32Array
  timeline: AdaptiveTimeline
  stylingAndLegend: StylingScarfFillingType
  /**
   * Precomputed layout widths used by the renderer.
   * These must match the values used when constructing the visual buffers.
   */
  leftLabelWidth: number
  plotAreaWidth: number

  /**
   * Rendering parameters needed for layout and interaction.
   */
  nonFixationHeight: number
  spaceAboveRect: number
  spaceAboveLine: number

  /**
   * Direct access to the binary segment buffers for zero-allocation rendering.
   */
  segmentBuffer: Float32Array
  indexTable: Uint32Array
  aoiPool: Uint16Array
  groupMap: Uint16Array
  maxParticipants: number

  /**
   * AOI ordering and visibility flags for the current stimulus.
   */
  aoiIds: Uint16Array
  aoiOrderIndex: Int16Array
  hiddenAoiFlags: Uint8Array
}
