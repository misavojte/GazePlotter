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
import { AdaptiveTimeline } from '../class/Plot/AdaptiveTimeline/AdaptiveTimeline'
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
 * @returns The timeline range and whether data is cut
 */
export function calculateTimelineMax(
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): {
  minValue: number
  maxValue: number
  isStartCut: boolean
  isEndCut: boolean
} {
  // For relative mode, we always use 0-100 as the range (percentage)
  if (settings.timeline === 'relative') {
    return { minValue: 0, maxValue: 100, isStartCut: false, isEndCut: false }
  }

  // Initialize cut flags
  const isStartCut = false
  const isEndCut = false

  // Get previously configured limits if available
  let minValue = 0
  let maxValue = 0

  if (settings.timeline === 'absolute') {
    // Get absolute timeline limits
    const absoluteLimits =
      settings.absoluteStimuliLimits[stimulusId] ??
      settings.absoluteGeneralLimits

    // Use the configured start value if available
    minValue = absoluteLimits?.[0] ?? 0

    // Use the configured end value if available, otherwise determine from data
    maxValue = absoluteLimits?.[1] ?? 0
  } else {
    // Get ordinal timeline limits
    const ordinalLimits =
      settings.ordinalStimuliLimits[stimulusId] ?? settings.ordinalGeneralLimits

    // Use the configured start value if available
    minValue = ordinalLimits?.[0] ?? 0

    // Use the configured end value if available, otherwise determine from data
    maxValue = ordinalLimits?.[1] ?? 0
  }

  // If maxValue is 0 (auto), find the highest end time among participants
  if (maxValue === 0) {
    for (const participantId of participantIds) {
      const numberOfSegments = getNumberOfSegments(stimulusId, participantId)

      if (numberOfSegments === 0) continue

      if (settings.timeline === 'ordinal') {
        if (numberOfSegments > maxValue) {
          maxValue = numberOfSegments
        }
        continue
      }

      // For absolute mode, find the actual end time
      const currentEndTime = getParticipantEndTime(stimulusId, participantId)
      if (currentEndTime > maxValue) {
        maxValue = currentEndTime
      }
    }
  }

  return { minValue, maxValue, isStartCut, isEndCut }
}

/**
 * Creates the axis breaks for the scarf plot
 *
 * @param participantIds Array of participant IDs to include
 * @param stimulusId ID of the stimulus to display
 * @param settings Configuration settings for the grid
 * @returns AdaptiveTimeline object with calculated ticks and bounds
 */
export function createScarfPlotAxis(
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): AdaptiveTimeline {
  const { minValue, maxValue } = calculateTimelineMax(
    participantIds,
    stimulusId,
    settings
  )

  // Create timeline with the appropriate range based on mode
  if (settings.timeline === 'relative') {
    // For relative mode, always use 0-100 range
    return new AdaptiveTimeline(0, 100)
  } else if (settings.timeline === 'ordinal') {
    // For ordinal mode, use minValue to maxValue (integer values)
    return new AdaptiveTimeline(
      minValue,
      maxValue,
      Math.min(10, maxValue - minValue)
    )
  } else {
    // For absolute mode, use minValue to maxValue in ms
    return new AdaptiveTimeline(minValue, maxValue)
  }
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
 * @param timelineMax Maximum timeline value
 * @param timelineMode The timeline mode (absolute, relative, ordinal)
 * @param timelineMin Minimum timeline value (default 0)
 * @returns Array of AOI visibility objects for visualization
 */
export function createAoiVisibility(
  stimulusId: number,
  participantId: number,
  aoiData: ExtendedInterpretedDataType[],
  sessionDuration: number,
  rectWrappedHeight: number,
  lineWrappedHeight: number,
  showAoiVisibility: boolean,
  timelineMax: number = sessionDuration,
  timelineMode: string = 'absolute',
  timelineMin: number = 0
): AoiVisibilityScarfFillingType[] {
  if (!showAoiVisibility) {
    return []
  }

  const result: AoiVisibilityScarfFillingType[] = []
  // Only apply timeline limits for absolute mode
  const shouldApplyLimits =
    timelineMode !== 'relative' && timelineMode !== 'ordinal'

  for (let aoiIndex = 0; aoiIndex < aoiData.length; aoiIndex++) {
    const aoiId = aoiData[aoiIndex].id
    const visibility = getAoiVisibility(stimulusId, aoiId, participantId)
    const visibilityContent: SingleAoiVisibilityScarfFillingType[] = []

    if (visibility !== null) {
      for (let i = 0; i < visibility.length; i += 2) {
        let start = visibility[i]
        let end = visibility[i + 1]

        // Only apply filtering for absolute timeline mode
        if (shouldApplyLimits) {
          // Skip visibility ranges entirely outside the timeline
          if (end <= timelineMin || start >= timelineMax) {
            continue
          }

          // Crop visibility ranges partially outside the timeline
          if (start < timelineMin) start = timelineMin
          if (end > timelineMax) end = timelineMax
        }

        const y = rectWrappedHeight + aoiIndex * lineWrappedHeight

        // Calculate position and width relative to the visible range
        const range = timelineMax - timelineMin
        const adjustedStart = start - timelineMin

        // Position as percentage of the viewable range
        const x1 = `${(adjustedStart / range) * 100}%`
        const x2 = `${((end - timelineMin) / range) * 100}%`

        visibilityContent.push({
          x1,
          x2,
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
 * @param timelineMin Minimum timeline value
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
  timelineMin: number,
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
    const isRelative = timeline === 'relative'

    let start = isOrdinal ? segmentId : segment.start
    let end = isOrdinal ? segmentId + 1 : segment.end

    // Skip segments entirely outside the timeline range
    if (!isRelative) {
      if (end <= timelineMin || start >= timelineMax) {
        continue
      }

      // Crop segments that are partially outside the timeline range
      if (start < timelineMin) start = timelineMin
      if (end > timelineMax) end = timelineMax
    }

    // Calculate position and width relative to the viewable range
    const range = isRelative ? sessionDuration : timelineMax - timelineMin
    const offset = isRelative ? 0 : timelineMin

    // Adjust the start position to account for the timeline minimum
    const adjustedStart = start - offset
    const width = end - start

    // Position as percentage of the viewable range
    const x = `${(adjustedStart / range) * 100}%`
    const widthPct = `${(width / range) * 100}%`

    segments.push({
      content: createSegmentContents(
        segment,
        x,
        widthPct,
        barHeight,
        nonFixationHeight,
        spaceAboveRect
      ),
    })
  }

  // Calculate width based on timeline type and visible range
  let width: string
  if (timeline === 'relative') {
    width = '100%'
  } else {
    // For absolute/ordinal, width depends on the visible timelineMax-timelineMin range
    const visibleRange = timelineMax - timelineMin
    width = `${(sessionDuration / visibleRange) * 100}%`
  }

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
      showAoiVisibility,
      timelineMax,
      timeline,
      timelineMin
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
  const minValue = timeline.minValue
  const maxValue = timeline.maxValue

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
      minValue,
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
      #${plotAreaId} rect:not(.${highlightedType}){opacity:0.15;}
      #${plotAreaId} line:not(.${highlightedType}){opacity:0.15;}
      #${plotAreaId} rect.${highlightedType}{stroke:#333333;stroke-width:0.5px;}
      #${plotAreaId} line.${highlightedType}{stroke-width:3px;stroke-linecap:butt;stroke-dasharray:none;}
    `
  }

  return '<style>' + rectRules + lineRules + highlightRules + '</style>'
}
