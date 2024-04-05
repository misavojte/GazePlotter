import { PlotAxisBreaks } from '../../../class/Plot/PlotAxisBreaks/PlotAxisBreaks.ts'
import type { StimulusScarfFillingType } from './StimulusScarfFilling/StimulusScarfFillingType.ts'
import type { StylingScarfFillingType } from './StylingScarfFilling/StylingScarfFillingType.ts'
import type { ParticipantScarfFillingType } from './ParticipantScarfFilling/ParticipantScarfFillingType.ts'

/**
 * Object that contains all information needed to draw a scarf plot for a single stimulus.
 * It is generated from raw const and scarf settings (height of bars etc.) by ScarfService.
 * Raw const are too complicated to be used directly in the scarf component.
 *
 * @param stimulusId - ID of the stimulus to be plotted
 * @param timeline - PlotAxisBreaks object containing information about the timeline
 * @param stylingAndLegend - ScarfStylingList object containing information about the styling of the scarf plot
 * @param barHeight - height of the bar representing a single participant
 * @param heightOfBarWrap - height of the bar with all the elements (participant bar, aoi bars, non-fixation bars)
 * @param chartHeight - height of the whole chart
 * @param participants - array of ScarfParticipant objects containing information about participants
 * @param stimuli - array of ScarfStimuliInfo objects containing information about stimuli (for stimuli selection)
 */
export interface ScarfFillingType {
  id: number
  stimulusId: number
  timelineType: 'absolute' | 'relative' | 'ordinal'
  timeline: PlotAxisBreaks
  stylingAndLegend: StylingScarfFillingType
  barHeight: number
  heightOfBarWrap: number
  chartHeight: number
  participants: ParticipantScarfFillingType[]
  stimuli: StimulusScarfFillingType[]
}
