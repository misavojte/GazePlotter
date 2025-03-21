/**
 * ScarfPlot Data Transformation Utilities
 *
 * This module contains pure functions for transforming the complex DataType structure
 * into various formats needed for rendering and exporting ScarfPlot data.
 *
 * The transformation process follows these steps:
 * 1. Calculate axis breaks and timeline settings
 * 2. Transform segments data into visualizable format
 * 3. Generate styling information for SVG elements
 *
 * Each function is designed to be pure, with clear inputs and outputs,
 * making them easily testable and composable.
 */

import type { ScarfGridType } from '$lib/type/gridType'
import type {
  AoiVisibilityScarfFillingType,
  ParticipantScarfFillingType,
  ScarfFillingType,
  SegmentScarfFillingType,
  SingleAoiVisibilityScarfFillingType,
  SingleSegmentScarfFillingType,
  SingleStylingScarfFillingType,
  StimulusScarfFillingType,
  StylingScarfFillingType,
} from '$lib/type/Filling/ScarfFilling/index'
import {
  getAois,
  getAoiVisibility,
  getNumberOfSegments,
  getParticipant,
  getParticipantEndTime,
  getSegment,
  getStimuli,
  hasStimulusAoiVisibility,
} from '$lib/stores/dataStore'
import { PlotAxisBreaks } from '$lib/class/Plot/PlotAxisBreaks/PlotAxisBreaks'
import {
  IDENTIFIER_IS_AOI,
  IDENTIFIER_IS_OTHER_CATEGORY,
  IDENTIFIER_NOT_DEFINED,
} from '$lib/const/identifiers'
import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType'

// Constants
const HEIGHT_OF_X_AXIS = 20
const DEFAULT_SEGMENT_CATEGORIES = [0, 1] // Fixations and saccades
const DEFAULT_BAR_HEIGHT = 20
const DEFAULT_NON_FIXATION_HEIGHT = 4
const DEFAULT_SPACE_ABOVE_RECT = 5
const DEFAULT_SPACE_ABOVE_LINE = 2

/**
 * Calculates the participant bar height based on configuration parameters
 *
 * @param barHeight Height of the main bar
 * @param spaceAboveRect Space above the rectangle
 * @param aoiCount Number of AOIs in the data
 * @param showAoiVisibility Whether to show AOI visibility timeline
 * @param lineWrappedHeight Height of wrapped line elements
 * @returns Total height needed for a participant bar
 */
export function getScarfParticipantBarHeight(
  barHeight: number,
  spaceAboveRect: number,
  aoiCount: number,
  showAoiVisibility: boolean,
  lineWrappedHeight: number
): number {
  const rectWrappedHeight = barHeight + spaceAboveRect * 2

  if (!showAoiVisibility) {
    return rectWrappedHeight
  }

  return rectWrappedHeight + aoiCount * lineWrappedHeight
}

/**
 * Calculates the maximum timeline value for the plot based on settings and participant data
 *
 * @param participantIds Array of participant IDs to include
 * @param stimulusId ID of the stimulus to display
 * @param settings Configuration settings for the grid
 * @returns The maximum timeline value and whether data is cut
 */
export function calculateTimelineMax(
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): { maxValue: number; isCut: boolean } {
  const isCut = false

  if (settings.timeline === 'relative') {
    return { maxValue: 100, isCut: false }
  }

  const absoluteTimelineLastVal =
    settings.absoluteStimuliLastVal[stimulusId] ??
    settings.absoluteGeneralLastVal

  const ordinalTimelineLastVal =
    settings.ordinalStimuliLastVal[stimulusId] ?? settings.ordinalGeneralLastVal

  let highestEndTime =
    settings.timeline === 'absolute'
      ? absoluteTimelineLastVal
      : ordinalTimelineLastVal

  // Find the highest end time among participants
  for (const participantId of participantIds) {
    const numberOfSegments = getNumberOfSegments(stimulusId, participantId)

    if (numberOfSegments === 0) continue

    if (settings.timeline === 'ordinal') {
      if (numberOfSegments > highestEndTime) {
        if (ordinalTimelineLastVal !== 0) {
          return { maxValue: highestEndTime, isCut: true }
        }
        highestEndTime = numberOfSegments
      }
      continue
    }

    const currentEndTime = getParticipantEndTime(stimulusId, participantId)
    if (currentEndTime > highestEndTime) {
      if (absoluteTimelineLastVal !== 0) {
        return { maxValue: highestEndTime, isCut: true }
      }
      highestEndTime = currentEndTime
    }
  }

  return { maxValue: highestEndTime, isCut }
}

/**
 * Creates the axis breaks for the scarf plot
 *
 * @param participantIds Array of participant IDs to include
 * @param stimulusId ID of the stimulus to display
 * @param settings Configuration settings for the grid
 * @returns PlotAxisBreaks object with calculated breaks
 */
export function createScarfPlotAxis(
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): PlotAxisBreaks {
  const { maxValue } = calculateTimelineMax(
    participantIds,
    stimulusId,
    settings
  )
  return new PlotAxisBreaks(maxValue)
}

/**
 * Creates a list of stimuli objects for display
 *
 * @param stimuliData Array of stimulus data
 * @returns Array of stimulus objects for the scarf plot
 */
export function createStimuliList(
  stimuliData: BaseInterpretedDataType[]
): StimulusScarfFillingType[] {
  return stimuliData.map(stimulus => ({
    id: stimulus.id,
    name: stimulus.displayedName,
  }))
}

/**
 * Creates styling information for scarf plot segments
 *
 * @param aoiData AOI data for the current stimulus
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param showAoiVisibility Whether to show AOI visibility
 * @returns Styling and legend information for the plot
 */
export function createStylingAndLegend(
  aoiData: ExtendedInterpretedDataType[],
  barHeight = DEFAULT_BAR_HEIGHT,
  nonFixationHeight = DEFAULT_NON_FIXATION_HEIGHT,
  showAoiVisibility = false
): StylingScarfFillingType {
  // Create AOI styling items
  const aoiStyling: SingleStylingScarfFillingType[] = aoiData.map(aoi => ({
    identifier: `${IDENTIFIER_IS_AOI}${aoi.id}`,
    name: aoi.displayedName,
    color: aoi.color,
    height: barHeight,
    heighOfLegendItem: barHeight,
  }))

  // Add styling for fixations without AOI
  aoiStyling.push({
    identifier: `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`,
    name: 'No AOI hit',
    color: '#a6a6a6',
    height: barHeight,
    heighOfLegendItem: barHeight,
  })

  // Create category styling items
  const categoryStyling: SingleStylingScarfFillingType[] = [
    {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${1}`,
      name: 'Saccade',
      color: '#555555',
      height: nonFixationHeight,
      heighOfLegendItem: barHeight,
    },
    {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${IDENTIFIER_NOT_DEFINED}`,
      name: 'Other',
      color: '#a6a6a6',
      height: nonFixationHeight,
      heighOfLegendItem: barHeight,
    },
  ]

  // Create AOI visibility styling if needed
  const visibilityStyling: SingleStylingScarfFillingType[] = !showAoiVisibility
    ? []
    : aoiData.map(aoi => ({
        identifier: `${IDENTIFIER_IS_AOI}${aoi.id}`,
        name: aoi.displayedName,
        color: aoi.color,
        height: nonFixationHeight,
        heighOfLegendItem: barHeight,
      }))

  return {
    visibility: visibilityStyling,
    aoi: aoiStyling,
    category: categoryStyling,
  }
}

/**
 * Creates a single segment content object for visualization
 *
 * @param segment Segment data
 * @param x X position as percentage string
 * @param width Width as percentage string
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param spaceAboveRect Space above the rectangle
 * @param segmentCategories Array of segment categories to show
 * @returns Array of segment content objects for visualization
 */
export function createSegmentContents(
  segment: SegmentInterpretedDataType,
  x: string,
  width: string,
  barHeight = DEFAULT_BAR_HEIGHT,
  nonFixationHeight = DEFAULT_NON_FIXATION_HEIGHT,
  spaceAboveRect = DEFAULT_SPACE_ABOVE_RECT,
  segmentCategories = DEFAULT_SEGMENT_CATEGORIES
): SingleSegmentScarfFillingType[] {
  // Handle non-fixation segment (e.g., saccade)
  if (segment.category.id !== 0) {
    const height = nonFixationHeight
    const y = spaceAboveRect + barHeight / 2 - height / 2

    let typeIdentifier = IDENTIFIER_NOT_DEFINED
    if (segmentCategories.includes(segment.category.id)) {
      typeIdentifier = segment.category.id.toString()
    }

    return [
      {
        x,
        y,
        width,
        height,
        identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${typeIdentifier}`,
      },
    ]
  }

  // Handle fixation without AOI
  if (segment.aoi.length === 0) {
    return [
      {
        x,
        y: spaceAboveRect,
        width,
        height: barHeight,
        identifier: `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`,
      },
    ]
  }

  // Handle fixation with AOIs
  const height = barHeight / segment.aoi.length
  const result: SingleSegmentScarfFillingType[] = []

  let yPosition = spaceAboveRect
  for (const aoi of segment.aoi) {
    result.push({
      x,
      y: yPosition,
      width,
      height,
      identifier: `${IDENTIFIER_IS_AOI}${aoi.id}`,
    })
    yPosition += height
  }

  return result
}

/**
 * Creates AOI visibility indicators for a participant
 *
 * @param stimulusId ID of the stimulus
 * @param participantId ID of the participant
 * @param aoiData AOI data for the current stimulus
 * @param sessionDuration Total session duration in ms
 * @param rectWrappedHeight Height of the wrapped rectangle
 * @param lineWrappedHeight Height of the wrapped line
 * @param showAoiVisibility Whether to show AOI visibility
 * @returns Array of AOI visibility objects for visualization
 */
export function createAoiVisibility(
  stimulusId: number,
  participantId: number,
  aoiData: ExtendedInterpretedDataType[],
  sessionDuration: number,
  rectWrappedHeight: number,
  lineWrappedHeight: number,
  showAoiVisibility: boolean
): AoiVisibilityScarfFillingType[] {
  if (!showAoiVisibility) {
    return []
  }

  const result: AoiVisibilityScarfFillingType[] = []

  for (let aoiIndex = 0; aoiIndex < aoiData.length; aoiIndex++) {
    const aoiId = aoiData[aoiIndex].id
    const visibility = getAoiVisibility(stimulusId, aoiId, participantId)
    const visibilityContent: SingleAoiVisibilityScarfFillingType[] = []

    if (visibility !== null) {
      for (let i = 0; i < visibility.length; i += 2) {
        const start = visibility[i]
        const end = visibility[i + 1]
        const y = rectWrappedHeight + aoiIndex * lineWrappedHeight

        visibilityContent.push({
          x1: `${(start / sessionDuration) * 100}%`,
          x2: `${(end / sessionDuration) * 100}%`,
          y,
          identifier: `${IDENTIFIER_IS_AOI}${aoiId}`,
        })
      }
    }

    result.push({ content: visibilityContent })
  }

  return result
}

/**
 * Creates a participant data object for visualization
 *
 * @param participantId ID of the participant
 * @param stimulusId ID of the stimulus
 * @param timeline Timeline settings
 * @param timelineMax Maximum timeline value
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param spaceAboveRect Space above the rectangle
 * @param spaceAboveLine Space above the line
 * @param aoiData AOI data for the current stimulus
 * @returns Participant data object for visualization or null if no segments
 */
export function createParticipantData(
  participantId: number,
  stimulusId: number,
  timeline: string,
  timelineMax: number,
  barHeight = DEFAULT_BAR_HEIGHT,
  nonFixationHeight = DEFAULT_NON_FIXATION_HEIGHT,
  spaceAboveRect = DEFAULT_SPACE_ABOVE_RECT,
  spaceAboveLine = DEFAULT_SPACE_ABOVE_LINE,
  aoiData: ExtendedInterpretedDataType[] = []
): ParticipantScarfFillingType | null {
  const segmentCount = getNumberOfSegments(stimulusId, participantId)

  if (segmentCount === 0) {
    return null
  }

  const sessionDuration = getParticipantEndTime(stimulusId, participantId)
  const participant = getParticipant(participantId)

  const rectWrappedHeight = barHeight + spaceAboveRect * 2
  const lineWrappedHeight = nonFixationHeight + spaceAboveLine

  const showAoiVisibility =
    hasStimulusAoiVisibility(stimulusId) && timeline !== 'ordinal'

  // Create segments
  const segments: SegmentScarfFillingType[] = []
  for (let segmentId = 0; segmentId < segmentCount; segmentId++) {
    const segment = getSegment(stimulusId, participantId, segmentId)
    const isOrdinal = timeline === 'ordinal'

    const start = isOrdinal ? segmentId : segment.start
    const end = isOrdinal ? segmentId + 1 : segment.end

    const x = `${(start / sessionDuration) * 100}%`
    const width = `${((end - start) / sessionDuration) * 100}%`

    segments.push({
      content: createSegmentContents(
        segment,
        x,
        width,
        barHeight,
        nonFixationHeight,
        spaceAboveRect
      ),
    })
  }

  // Calculate width based on timeline type
  const width =
    timeline === 'relative'
      ? '100%'
      : `${(sessionDuration / timelineMax) * 100}%`

  return {
    id: participantId,
    label: participant.displayedName,
    segments,
    width,
    dynamicAoiVisibility: createAoiVisibility(
      stimulusId,
      participantId,
      aoiData,
      sessionDuration,
      rectWrappedHeight,
      lineWrappedHeight,
      showAoiVisibility
    ),
  }
}

/**
 * Transforms DataType into ScarfFillingType for visualization
 *
 * @param stimulusId ID of the stimulus to display
 * @param participantIds Array of participant IDs to include
 * @param settings Configuration settings for the grid
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param spaceAboveRect Space above the rectangle
 * @param spaceAboveLine Space above the line
 * @returns Complete data object for ScarfPlot visualization
 */
export function transformDataToScarfPlot(
  stimulusId: number,
  participantIds: number[],
  settings: ScarfGridType,
  barHeight = DEFAULT_BAR_HEIGHT,
  nonFixationHeight = DEFAULT_NON_FIXATION_HEIGHT,
  spaceAboveRect = DEFAULT_SPACE_ABOVE_RECT / 2,
  spaceAboveLine = DEFAULT_SPACE_ABOVE_LINE
): ScarfFillingType {
  // Get basic data
  const aoiData = getAois(stimulusId)
  const stimuliData = getStimuli()
  const timeline = createScarfPlotAxis(participantIds, stimulusId, settings)
  const { maxValue } = calculateTimelineMax(
    participantIds,
    stimulusId,
    settings
  )

  const showAoiVisibility =
    hasStimulusAoiVisibility(stimulusId) && settings.timeline !== 'ordinal'

  // Calculate heights
  const lineWrappedHeight = nonFixationHeight + spaceAboveLine

  const barWrapHeight = getScarfParticipantBarHeight(
    barHeight,
    spaceAboveRect,
    aoiData.length,
    showAoiVisibility,
    lineWrappedHeight
  )

  // Create participants data
  const participants: ParticipantScarfFillingType[] = []
  for (const participantId of participantIds) {
    const participant = createParticipantData(
      participantId,
      stimulusId,
      settings.timeline,
      maxValue,
      barHeight,
      nonFixationHeight,
      spaceAboveRect,
      spaceAboveLine,
      aoiData
    )

    if (participant) {
      participants.push(participant)
    }
  }

  // Create styling and stimulus list
  const stylingAndLegend = createStylingAndLegend(
    aoiData,
    barHeight,
    nonFixationHeight,
    showAoiVisibility
  )
  const stimuli = createStimuliList(stimuliData)

  // Calculate chart height
  const chartHeight = participants.length * barWrapHeight + HEIGHT_OF_X_AXIS

  return {
    id: stimulusId,
    timelineType: settings.timeline,
    barHeight,
    stimulusId,
    heightOfBarWrap: barWrapHeight,
    chartHeight,
    stimuli,
    participants,
    timeline,
    stylingAndLegend,
  }
}

/**
 * Generates CSS rules for a scarf plot
 *
 * @param plotAreaId ID of the plot area element
 * @param stylingData Styling data for the plot
 * @param highlightedType Type identifier for highlighted elements
 * @returns CSS string for the plot
 */
export function generateScarfPlotCSS(
  plotAreaId: string,
  stylingData: StylingScarfFillingType,
  highlightedType: string | null
): string {
  const { aoi, category, visibility } = stylingData

  // Generate CSS rules for rectangles
  const rectRules = [...aoi, ...category]
    .map(style => {
      const { color, identifier } = style
      return `#${plotAreaId} .${identifier}{fill:${color};}`
    })
    .join('')

  // Generate CSS rules for lines
  const lineRules = visibility
    .map(style => {
      const { color, identifier, height } = style
      return `#${plotAreaId} line.${identifier}{stroke:${color};stroke-width:${height};stroke-dasharray:1;}`
    })
    .join('')

  // Generate highlight rules
  let highlightRules = ''
  if (highlightedType) {
    highlightRules = `
      #${plotAreaId} rect:not(.${highlightedType}){opacity:0.2;}
      #${plotAreaId} line:not(.${highlightedType}){opacity:0.2;}
      #${plotAreaId} line.${highlightedType}{stroke-width:100%;}
    `
  }

  return '<style>' + rectRules + lineRules + highlightRules + '</style>'
}
