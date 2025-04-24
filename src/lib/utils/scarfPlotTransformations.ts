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
 * Calculates the timeline range for the plot based on settings and participant data
 *
 * @param participantIds Array of participant IDs to include
 * @param stimulusId ID of the stimulus to display
 * @param settings Configuration settings for the grid
 * @returns The timeline range values
 */
export function calculateTimelineRange(
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): { minValue: number; maxValue: number } {
  // For relative mode, we always use 0-100 range (percentage)
  if (settings.timeline === 'relative') {
    return { minValue: 0, maxValue: 100 }
  }

  let minValue = 0
  let maxValue = 0

  if (settings.timeline === 'absolute') {
    // Get absolute timeline limits for the specific stimulus
    const stimulusSpecificLimits = settings.absoluteStimuliLimits?.[stimulusId]

    // Use stimulus-specific limits if available, otherwise use default [0, 0]
    if (
      Array.isArray(stimulusSpecificLimits) &&
      stimulusSpecificLimits.length === 2
    ) {
      ;[minValue, maxValue] = stimulusSpecificLimits
    }
  } else {
    // 'ordinal' timeline
    // Get ordinal timeline limits for the specific stimulus
    const stimulusSpecificLimits = settings.ordinalStimuliLimits?.[stimulusId]

    // Use stimulus-specific limits if available, otherwise use default [0, 0]
    if (
      Array.isArray(stimulusSpecificLimits) &&
      stimulusSpecificLimits.length === 2
    ) {
      ;[minValue, maxValue] = stimulusSpecificLimits
    }
  }

  // Ensure minValue is at least 0
  minValue = Math.max(0, minValue)

  // If maxValue is 0 (auto), calculate it from data
  if (maxValue === 0) {
    for (const participantId of participantIds) {
      const numberOfSegments = getNumberOfSegments(stimulusId, participantId)

      if (numberOfSegments === 0) continue

      if (settings.timeline === 'ordinal') {
        if (numberOfSegments > maxValue) {
          maxValue = numberOfSegments
        }
      } else {
        // 'absolute' timeline
        const endTime = getParticipantEndTime(stimulusId, participantId)
        if (endTime > maxValue) {
          maxValue = endTime
        }
      }
    }
  }

  // If the calculated maxValue is less than or equal to minValue after auto-calculation,
  // add a small buffer to ensure a valid range
  if (maxValue <= minValue) {
    maxValue = minValue + (settings.timeline === 'ordinal' ? 10 : 1000) // 10 segments or 1000ms
  }

  return { minValue, maxValue }
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
  const { minValue, maxValue } = calculateTimelineRange(
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
 * @param x X position as decimal (0-1)
 * @param width Width as decimal (0-1)
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param spaceAboveRect Space above the rectangle
 * @param segmentCategories Array of segment categories to show
 * @param orderId The original order ID of the segment
 * @returns Array of segment content objects for visualization
 */
export function createSegmentContents(
  segment: SegmentInterpretedDataType,
  x: number,
  width: number,
  barHeight = DEFAULT_BAR_HEIGHT,
  nonFixationHeight = DEFAULT_NON_FIXATION_HEIGHT,
  spaceAboveRect = DEFAULT_SPACE_ABOVE_RECT,
  segmentCategories = DEFAULT_SEGMENT_CATEGORIES,
  orderId: number
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
        orderId,
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
        orderId,
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
      orderId,
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
 * @param timelineMin Minimum timeline value
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

  // Calculate the visible timeline range
  const visibleRange = timelineMax - timelineMin

  // Get the actual participant data bounds to crop visibility lines
  const participantStart = 0 // Always start at 0
  const participantEnd = sessionDuration // Use actual session duration

  for (let aoiIndex = 0; aoiIndex < aoiData.length; aoiIndex++) {
    const aoiId = aoiData[aoiIndex].id
    const visibility = getAoiVisibility(stimulusId, aoiId, participantId)
    const visibilityContent: SingleAoiVisibilityScarfFillingType[] = []

    if (visibility !== null) {
      for (let i = 0; i < visibility.length; i += 2) {
        let start = visibility[i]
        let end = visibility[i + 1]

        // Crop visibility to participant's data range first
        if (end <= participantStart || start >= participantEnd) {
          continue
        }

        if (start < participantStart) start = participantStart
        if (end > participantEnd) end = participantEnd

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

        // Calculate position as decimal (0-1) of the visible range
        let x1: number
        let x2: number

        if (timelineMode === 'relative') {
          // For relative timeline, position is calculated relative to the session duration
          x1 = start / sessionDuration
          x2 = end / sessionDuration
        } else {
          // For absolute/ordinal, position is calculated relative to the visible range
          const adjustedStart = start - timelineMin
          const adjustedEnd = end - timelineMin

          x1 = adjustedStart / visibleRange
          x2 = adjustedEnd / visibleRange
        }

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

  // Pre-flattened segments array for performance optimization
  const flattenedRectangles: Array<{
    identifier: string
    height: number
    rawX: number
    rawWidth: number
    y: number
    participantId: number
    segmentId: number
    orderId: number
  }> = []

  // Pre-flattened visibility lines array
  const flattenedLines: Array<{
    identifier: string
    rawX1: number
    rawX2: number
    y: number
    participantId: number
  }> = []

  for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
    const participantId = participantIds[pIndex]
    const segmentCount = getNumberOfSegments(stimulusId, participantId)

    if (segmentCount === 0) continue

    const sessionDuration = getParticipantEndTime(stimulusId, participantId)
    const participant = getParticipant(participantId)

    const rectWrappedHeight = barHeight + spaceAboveRect * 2

    // Calculate the visible timeline range
    const visibleRange = maxValue - minValue
    const yOffset = pIndex * barWrapHeight

    // Process all segments directly into flattened array
    for (let segmentId = 0; segmentId < segmentCount; segmentId++) {
      const segment = getSegment(stimulusId, participantId, segmentId)
      const isOrdinal = settings.timeline === 'ordinal'
      const isRelative = settings.timeline === 'relative'

      let start = isOrdinal ? segmentId : segment.start
      let end = isOrdinal ? segmentId + 1 : segment.end

      // Skip segments entirely outside the timeline range
      // For relative timeline, we don't apply cropping
      if (!isRelative) {
        if (end <= minValue || start >= maxValue) {
          continue
        }

        // Crop segments that are partially outside the timeline range
        if (start < minValue) start = minValue
        if (end > maxValue) end = maxValue
      }

      // Calculate position and width as decimals (0-1)
      let x: number
      let width: number

      if (isRelative) {
        // For relative timeline, position is relative to the session duration
        x = start / sessionDuration
        width = (end - start) / sessionDuration
      } else {
        // For absolute/ordinal timeline, position is relative to the visible range
        const adjustedStart = start - minValue
        const segmentWidth = end - start

        x = adjustedStart / visibleRange
        width = segmentWidth / visibleRange
      }

      // Create segment content directly into flattened array
      const contents = createSegmentContents(
        segment,
        x,
        width,
        barHeight,
        nonFixationHeight,
        spaceAboveRect,
        undefined,
        segmentId
      )

      // Add to the flattened rectangles array with pre-calculated y offset
      for (const rectangle of contents) {
        flattenedRectangles.push({
          identifier: rectangle.identifier,
          height: rectangle.height,
          rawX: rectangle.x,
          rawWidth: rectangle.width,
          y: yOffset + rectangle.y,
          participantId,
          segmentId,
          orderId: rectangle.orderId,
        })
      }
    }

    // Calculate width as decimal (0-1)
    let width: number

    if (settings.timeline === 'relative') {
      width = 1.0 // equivalent to 100%
    } else {
      // For absolute/ordinal, the width depends on session duration and visible range
      width =
        (Math.min(sessionDuration, maxValue) - Math.max(0, minValue)) /
        visibleRange
    }

    // Process AOI visibility lines
    const dynamicAoiVisibility = createAoiVisibility(
      stimulusId,
      participantId,
      aoiData,
      sessionDuration,
      rectWrappedHeight,
      lineWrappedHeight,
      showAoiVisibility,
      maxValue,
      settings.timeline,
      minValue
    )

    // Pre-flatten visibility lines
    if (showAoiVisibility) {
      dynamicAoiVisibility.forEach(visibility => {
        visibility.content.forEach(line => {
          flattenedLines.push({
            identifier: line.identifier,
            rawX1: line.x1,
            rawX2: line.x2,
            y: yOffset + line.y,
            participantId,
          })
        })
      })
    }

    participants.push({
      id: participantId,
      label: participant.displayedName,
      width,
    })
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
    flattenedRectangles,
    flattenedLines,
  }
}
