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

import type { ScarfGridType } from '$lib/workspace/type/gridType'
import type {
  AoiVisibilityScarfFillingType,
  ParticipantScarfFillingType,
  ScarfFillingType,
  SingleAoiVisibilityScarfFillingType,
  SingleSegmentScarfFillingType,
  SingleStylingScarfFillingType,
  StimulusScarfFillingType,
  StylingScarfFillingType,
} from '$lib/plots/scarf/types'
import {
  getAois,
  getAoiIdMapping,
  getAoiVisibility,
  getData,
  getHiddenAois,
  getNumberOfSegments,
  getParticipant,
  getParticipantEndTime,
  getStimuli,
  hasStimulusAoiVisibility,
} from '$lib/gaze-data/front-process/stores/dataStore'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import {
  IDENTIFIER_IS_AOI,
  IDENTIFIER_IS_OTHER_CATEGORY,
  IDENTIFIER_NOT_DEFINED,
} from '$lib/plots/scarf/const/identifiers'
import {
  MAX_AOI_PER_STIMULUS,
  SEGMENT_STRIDE,
  SegmentField,
} from '$lib/gaze-data/shared/types'
import type {
  BaseInterpretedDataType,
  ExtendedInterpretedDataType,
  SegmentInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { calculateLabelOffset } from '$lib/shared/utils/textUtils'

// Constants
const HEIGHT_OF_X_AXIS = 20
const DEFAULT_SEGMENT_CATEGORIES = [0, 1] // Fixations and saccades
const DEFAULT_BAR_HEIGHT = 20
const DEFAULT_NON_FIXATION_HEIGHT = 4
const DEFAULT_SPACE_ABOVE_RECT = 5
const DEFAULT_SPACE_ABOVE_LINE = 2

const RECT_STRIDE = 8
const LINE_STRIDE = 6

type ScarfVisualConfig = {
  chartWidth: number
  marginLeft?: number
  marginTop?: number
  padding?: number
  rightMargin?: number
  labelFontSize?: number
}

class Float32GrowBuffer {
  private buffer: Float32Array
  private writeIndex: number

  constructor(initialCapacityFloats: number) {
    this.buffer = new Float32Array(initialCapacityFloats)
    this.writeIndex = 0
  }

  private ensureCapacity(additionalFloats: number) {
    const required = this.writeIndex + additionalFloats
    if (required <= this.buffer.length) return

    let newLength = this.buffer.length
    while (newLength < required) {
      newLength = Math.max(1024, newLength * 2)
    }

    const next = new Float32Array(newLength)
    next.set(this.buffer)
    this.buffer = next
  }

  pushRect(
    x: number,
    y: number,
    width: number,
    height: number,
    participantId: number,
    segmentId: number,
    orderId: number
  ) {
    this.ensureCapacity(RECT_STRIDE)

    const idx = this.writeIndex
    const b = this.buffer

    b[idx] = x
    b[idx + 1] = y
    b[idx + 2] = width
    b[idx + 3] = height
    b[idx + 4] = participantId
    b[idx + 5] = segmentId
    b[idx + 6] = orderId
    b[idx + 7] = 0 // reserved

    this.writeIndex += RECT_STRIDE
  }

  pushLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    participantId: number
  ) {
    this.ensureCapacity(LINE_STRIDE)

    const idx = this.writeIndex
    const b = this.buffer

    b[idx] = x1
    b[idx + 1] = y1
    b[idx + 2] = x2
    b[idx + 3] = y2
    b[idx + 4] = participantId
    b[idx + 5] = 0 // reserved

    this.writeIndex += LINE_STRIDE
  }

  finalize(): Float32Array {
    return this.buffer.slice(0, this.writeIndex)
  }
}

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
        // 'absolute' timeline - getParticipantEndTime now uses cached _reader for efficiency
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
    return createAdaptiveTimeline(0, 100)
  } else if (settings.timeline === 'ordinal') {
    // For ordinal mode, use minValue to maxValue (integer values)
    return createAdaptiveTimeline(
      minValue,
      maxValue,
      Math.min(10, maxValue - minValue)
    )
  } else {
    // For absolute mode, use minValue to maxValue in ms
    return createAdaptiveTimeline(minValue, maxValue)
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
 * @param noAoiTreatment Configuration for No AOI hit styling
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param showAoiVisibility Whether to show AOI visibility
 * @returns Styling and legend information for the plot
 */
export function createStylingAndLegend(
  aoiData: ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
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
    name: noAoiTreatment.displayedName,
    color: noAoiTreatment.color,
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
  const categoryId = segment.category.id
  if (categoryId !== 0) {
    const height = nonFixationHeight
    /*
     * We vertically center the non-fixation segment by adding half the height of the bar
     * to the space above the rectangle and then subtracting half the height of the segment.
     * We use bitwise operations to improve performance, as the downsides are bearable
     * in this case.
     */
    const y = spaceAboveRect + (barHeight >> 1) - (height >> 1)

    let typeIdentifier = IDENTIFIER_NOT_DEFINED
    if (segmentCategories.includes(categoryId)) {
      typeIdentifier = categoryId.toString()
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

  // Cache this calculation that's repeated in multiple places
  const isRel = timelineMode === 'relative'
  const isOrd = timelineMode === 'ordinal'
  const shouldApplyLimits = !isRel && !isOrd

  // Calculate the visible timeline range
  const visibleRange = timelineMax - timelineMin

  // Get the actual participant data bounds to crop visibility lines
  const participantStart = 0 // Always start at 0
  const participantEnd = sessionDuration // Use actual session duration

  const numberOfAois = aoiData.length
  for (let aoiIndex = 0; aoiIndex < numberOfAois; aoiIndex++) {
    const aoiId = aoiData[aoiIndex].id
    const visibility = getAoiVisibility(stimulusId, aoiId, participantId)
    const visibilityContent: SingleAoiVisibilityScarfFillingType[] = []

    if (visibility !== null) {
      const numberOfVisibilityRanges = visibility.length
      for (let i = 0; i < numberOfVisibilityRanges; i += 2) {
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

        if (isRel) {
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
 * @param noAoiTreatment Configuration for No AOI hit styling
 * @param barHeight Height of the main bar
 * @param nonFixationHeight Height of non-fixation elements
 * @param spaceAboveRect Space above the rectangle
 * @param spaceAboveLine Space above the line
 * @param visual Visual configuration
 * @returns Complete data object for ScarfPlot visualization
 */
export function transformDataToScarfPlot(
  stimulusId: number,
  participantIds: number[],
  settings: ScarfGridType,
  noAoiTreatment: { displayedName: string; color: string },
  barHeight = DEFAULT_BAR_HEIGHT,
  nonFixationHeight = DEFAULT_NON_FIXATION_HEIGHT,
  spaceAboveRect = DEFAULT_SPACE_ABOVE_RECT / 2,
  spaceAboveLine = DEFAULT_SPACE_ABOVE_LINE,
  visual: ScarfVisualConfig
): ScarfFillingType {
  if (!visual || !Number.isFinite(visual.chartWidth)) {
    throw new Error('transformDataToScarfPlot: visual.chartWidth is required')
  }

  const marginLeft = visual.marginLeft ?? 0
  const marginTop = visual.marginTop ?? 0
  const padding = visual.padding ?? 0
  const rightMargin = visual.rightMargin ?? 0
  const labelFontSize = visual.labelFontSize ?? 12

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

  // Create styling and stimulus list
  const stylingAndLegend = createStylingAndLegend(
    aoiData,
    noAoiTreatment,
    barHeight,
    nonFixationHeight,
    showAoiVisibility
  )
  const stimuli = createStimuliList(stimuliData)

  // Build style index mapping to avoid per-segment identifier string work.
  // IMPORTANT: This must match the identifier order used by ScarfPlotFigure's identifierSystem.
  const aoiStyleCount = stylingAndLegend.aoi.length
  const categoryStyleCount = stylingAndLegend.category.length
  const visibilityStyleCount = stylingAndLegend.visibility.length

  // AOI styles are created from aoiData (same order) plus one trailing "No AOI hit".
  const aoiOrderIndex = new Int16Array(MAX_AOI_PER_STIMULUS)
  aoiOrderIndex.fill(-1)
  for (let i = 0; i < aoiData.length; i++) {
    const id = aoiData[i].id
    if (id >= 0 && id < MAX_AOI_PER_STIMULUS) {
      aoiOrderIndex[id] = i
    }
  }

  const noAoiStyleIdx = aoiData.length
  const saccadeStyleIdx = aoiStyleCount // first category index
  const otherCategoryStyleIdx = aoiStyleCount + 1
  const visibilityBaseStyleIdx = aoiStyleCount + categoryStyleCount

  // Precompute LEFT_LABEL_WIDTH in the same way the figure used to.
  // This must happen before building the visual buffers.
  const participantLabels: string[] = []
  for (let i = 0; i < participantIds.length; i++) {
    participantLabels.push(getParticipant(participantIds[i]).displayedName)
  }

  const leftLabelWidth =
    calculateLabelOffset(participantLabels, labelFontSize) + 10

  const plotAreaWidth = Math.max(
    0,
    visual.chartWidth - leftLabelWidth - (padding << 1) - rightMargin
  )

  // Create participants data
  const participants: ParticipantScarfFillingType[] = []

  // Create bucketed visual buffers - one buffer per style
  const totalStyleCount =
    aoiStyleCount + categoryStyleCount + visibilityStyleCount
  const rectBucketBuilders: Float32GrowBuffer[] = []
  const lineBucketBuilders: Float32GrowBuffer[] = []

  for (let i = 0; i < totalStyleCount; i++) {
    rectBucketBuilders.push(new Float32GrowBuffer(RECT_STRIDE * 128))
    lineBucketBuilders.push(new Float32GrowBuffer(LINE_STRIDE * 64))
  }

  // Cache this calculation that's repeated in multiple places
  const isOrdinal = settings.timeline === 'ordinal'
  const isRelative = settings.timeline === 'relative'

  const currentData = getData()
  const buffers = currentData.segments
  const segmentBuffer = buffers.segmentBuffer
  const indexTable = buffers.indexTable
  const aoiPool = buffers.aoiPool
  const maxParticipants = buffers.maxParticipants

  const hiddenRaw = getHiddenAois(stimulusId)
  const hiddenFlag = new Uint8Array(MAX_AOI_PER_STIMULUS)
  for (let i = 0; i < hiddenRaw.length; i++) {
    const id = hiddenRaw[i]
    if (id >= 0 && id < MAX_AOI_PER_STIMULUS) hiddenFlag[id] = 1
  }

  // Reusable per-participant/per-segment scratch to avoid allocations
  const present = new Uint8Array(MAX_AOI_PER_STIMULUS)
  const presentList: number[] = []

  const numberOfParticipants = participantIds.length
  for (let pIndex = 0; pIndex < numberOfParticipants; pIndex++) {
    const participantId = participantIds[pIndex]
    const displayedName = participantLabels[pIndex]
    const sessionDuration = getParticipantEndTime(stimulusId, participantId)

    const rectWrappedHeight = barHeight + (spaceAboveRect << 1) // just a bit faster instead of * 2

    // Calculate the visible timeline range
    const visibleRange = maxValue - minValue
    const yOffset = pIndex * barWrapHeight

    // Segment range in master buffers
    const rangeIdx = (stimulusId * maxParticipants + participantId) * 2
    const startIndex = indexTable[rangeIdx]
    const endIndex = indexTable[rangeIdx + 1]
    const segmentCount = endIndex - startIndex

    if (segmentCount > 0) {
      for (
        let localSegmentId = 0;
        localSegmentId < segmentCount;
        localSegmentId++
      ) {
        const segmentIndex = startIndex + localSegmentId
        const base = segmentIndex * SEGMENT_STRIDE

        const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID] | 0
        const startTime = segmentBuffer[base + SegmentField.START_TIME]
        const endTime = segmentBuffer[base + SegmentField.END_TIME]

        let start = isOrdinal ? localSegmentId : startTime
        let end = isOrdinal ? localSegmentId + 1 : endTime

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
          // Prevent division by zero
          const safeDuration = sessionDuration > 0 ? sessionDuration : 1
          x = start / safeDuration
          width = (end - start) / safeDuration
        } else {
          // For absolute/ordinal timeline, position is relative to the visible range
          const adjustedStart = start - minValue
          const segmentWidth = end - start

          x = adjustedStart / visibleRange
          width = segmentWidth / visibleRange
        }

        // Convert to pixel coords once (visual buffers are pixel-based)
        const pxX = leftLabelWidth + x * plotAreaWidth + marginLeft
        const pxW = width * plotAreaWidth

        // Build rectangles directly from binary buffers
        if (categoryId !== 0) {
          const pxY =
            yOffset +
            (spaceAboveRect + (barHeight >> 1) - (nonFixationHeight >> 1)) +
            marginTop
          const styleIdx =
            categoryId === 1 ? saccadeStyleIdx : otherCategoryStyleIdx
          rectBucketBuilders[styleIdx].pushRect(
            pxX,
            pxY,
            pxW,
            nonFixationHeight,
            participantId,
            localSegmentId,
            localSegmentId
          )
          continue
        }

        const aoiCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
        const aoiPtr = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

        if (aoiCount <= 0) {
          const pxY = yOffset + spaceAboveRect + marginTop
          rectBucketBuilders[noAoiStyleIdx].pushRect(
            pxX,
            pxY,
            pxW,
            barHeight,
            participantId,
            localSegmentId,
            localSegmentId
          )
          continue
        }

        // Build set of present grouped AOIs (deduped) without allocations
        presentList.length = 0
        for (let i = 0; i < aoiCount; i++) {
          const rawId = aoiPool[aoiPtr + i]
          if (rawId < 0 || rawId >= MAX_AOI_PER_STIMULUS) continue
          if (hiddenFlag[rawId] === 1) continue
          const groupId = getAoiIdMapping(stimulusId, rawId)
          if (groupId < 0 || groupId >= MAX_AOI_PER_STIMULUS) continue
          if (present[groupId] === 0) {
            present[groupId] = 1
            presentList.push(groupId)
          }
        }

        const uniqueAoiCount = presentList.length
        if (uniqueAoiCount === 0) {
          const pxY = yOffset + spaceAboveRect + marginTop
          rectBucketBuilders[noAoiStyleIdx].pushRect(
            pxX,
            pxY,
            pxW,
            barHeight,
            participantId,
            localSegmentId,
            localSegmentId
          )
          continue
        }

        const aoiRectHeight = barHeight / uniqueAoiCount
        let yLocal = spaceAboveRect
        let emitted = 0

        // Emit AOIs in stimulus order
        for (let aoiIdx = 0; aoiIdx < aoiData.length; aoiIdx++) {
          const orderedId = aoiData[aoiIdx].id
          if (orderedId < 0 || orderedId >= MAX_AOI_PER_STIMULUS) continue
          if (present[orderedId] === 1) {
            const pxY = yOffset + yLocal + marginTop
            rectBucketBuilders[aoiIdx].pushRect(
              pxX,
              pxY,
              pxW,
              aoiRectHeight,
              participantId,
              localSegmentId,
              localSegmentId
            )
            yLocal += aoiRectHeight
            emitted++
            present[orderedId] = 0
          }
        }

        // Emit any remaining (unexpected) AOIs at the end to preserve visibility
        if (emitted < uniqueAoiCount) {
          for (let i = 0; i < presentList.length; i++) {
            const remainingId = presentList[i]
            if (present[remainingId] === 1) {
              const orderIdx = aoiOrderIndex[remainingId]
              const styleIdx = orderIdx >= 0 ? orderIdx : noAoiStyleIdx
              const pxY = yOffset + yLocal + marginTop
              rectBucketBuilders[styleIdx].pushRect(
                pxX,
                pxY,
                pxW,
                aoiRectHeight,
                participantId,
                localSegmentId,
                localSegmentId
              )
              yLocal += aoiRectHeight
              present[remainingId] = 0
            }
          }
        }
      }
    }

    // Calculate width as decimal (0-1)
    let width: number

    if (settings.timeline === 'relative') {
      width = 1.0 // equivalent to 100%
    } else {
      // For absolute/ordinal, the width depends on session duration and visible range
      // For empty participants, use a default width of 0
      width =
        sessionDuration > 0
          ? (Math.min(sessionDuration, maxValue) - Math.max(0, minValue)) /
            visibleRange
          : 0
    }

    // Process AOI visibility lines directly into the line buffer
    if (showAoiVisibility && visibilityStyleCount > 0) {
      const isRel = settings.timeline === 'relative'
      const shouldApplyLimits = !isRel // ordinal already excluded by showAoiVisibility

      // Calculate the visible timeline range
      const visible = maxValue - minValue

      // Crop visibility to participant's data range
      const participantStart = 0
      const participantEnd = sessionDuration

      for (let aoiIdx = 0; aoiIdx < aoiData.length; aoiIdx++) {
        const aoiId = aoiData[aoiIdx].id
        const visibility = getAoiVisibility(stimulusId, aoiId, participantId)
        if (visibility == null) continue

        const styleIdx = visibilityBaseStyleIdx + aoiIdx
        const y =
          yOffset + rectWrappedHeight + aoiIdx * lineWrappedHeight + marginTop

        for (let i = 0; i < visibility.length; i += 2) {
          let start = visibility[i]
          let end = visibility[i + 1]

          // Crop to participant bounds
          if (end <= participantStart || start >= participantEnd) {
            continue
          }
          if (start < participantStart) start = participantStart
          if (end > participantEnd) end = participantEnd

          // Crop to timeline window (absolute only)
          if (shouldApplyLimits) {
            if (end <= minValue || start >= maxValue) {
              continue
            }
            if (start < minValue) start = minValue
            if (end > maxValue) end = maxValue
          }

          let x1: number
          let x2: number

          if (isRel) {
            const safeDuration = sessionDuration > 0 ? sessionDuration : 1
            x1 = start / safeDuration
            x2 = end / safeDuration
          } else {
            const adjustedStart = start - minValue
            const adjustedEnd = end - minValue
            x1 = adjustedStart / visible
            x2 = adjustedEnd / visible
          }

          const pxX1 = leftLabelWidth + x1 * plotAreaWidth + marginLeft
          const pxX2 = leftLabelWidth + x2 * plotAreaWidth + marginLeft
          lineBucketBuilders[styleIdx].pushLine(pxX1, y, pxX2, y, participantId)
        }
      }
    }

    // Always add the participant, even with zero segments
    participants.push({
      id: participantId,
      label: displayedName,
      width,
    })
  }

  // Calculate chart height
  const chartHeight = numberOfParticipants * barWrapHeight + HEIGHT_OF_X_AXIS

  // Finalize all buckets
  const visualRectBuckets: Float32Array[] = []
  const visualLineBuckets: Float32Array[] = []

  for (let i = 0; i < totalStyleCount; i++) {
    visualRectBuckets.push(rectBucketBuilders[i].finalize())
    visualLineBuckets.push(lineBucketBuilders[i].finalize())
  }

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
    leftLabelWidth,
    plotAreaWidth,
    visualRectBuckets,
    visualLineBuckets,
  }
}
