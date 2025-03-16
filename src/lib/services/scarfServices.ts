import { getAois, getParticipants } from '$lib/stores/dataStore'

/**
 * Helper function to calculate the height of the scarf legend group based on the current data in pixels.
 * @param length length of the scarf legend item in pixels
 * @param height height of the scarf legend item in pixels
 * @param numberPerRow number of items per row in the scarf legend
 * @returns the height of the scarf legend in pixels
 */
export const getScarfLegendHeight = (
  length: number,
  height: number,
  numberPerRow: number
) => {
  return height * (length / numberPerRow)
}

/**
 * Helper function to calculate the height of the scarf participant bar based on the current data in pixels.
 * @param heightOfBar height of the participant bar in pixels
 * @param spaceAboveRect space above the rectangle in pixels
 * @param aoiDataLength number of AOIs in the current data
 * @param showAoiVisibility boolean indicating whether AOI visibility is shown
 * @param lineWrappedHeight height of the line indicating AOI visibility in pixels
 * @returns the height of the scarf participant bar in pixels
 */
export const getScarfParticipantBarHeight = (
  heightOfBar: number,
  spaceAboveRect: number,
  aoiDataLength: number,
  showAoiVisibility: boolean,
  lineWrappedHeight: number
): number => {
  // Placeholder logic for calculating bar height based on parameters
  const baseHeight = heightOfBar + spaceAboveRect * 2
  // Adjust baseHeight based on dynamicAOI, gaps, etc., using additionalParameters as needed

  // Conditionally adjust the height if AOI visibility is shown
  return showAoiVisibility
    ? baseHeight + lineWrappedHeight * aoiDataLength
    : baseHeight
}

/**
 * Helper function to calculate the height of the scarf grid based on the current data in pixels.
 * @param participantIds array of participant IDs
 * @param isAoiVisible boolean indicating whether AOI is visible in the current context
 * @param aoiDataLength number of AOIs in the current data
 * @returns the height of the scarf based on the current data in pixels
 */
export const getScarfHeight = (
  participantIds: number[],
  isAoiVisible: boolean,
  aoiDataLength: number
) => {
  // Placeholder logic for calculating grid height based on parameters
  const HEIGHT_OF_BAR = 20
  const HEIGHT_OF_LEGEND_BAR = 32
  const SPACE_ABOVE_RECT = 5
  const LINE_WRAPPED_HEIGHT = 6
  const NUMBER_PER_ROW = 4

  const ADD_HEIGHT = 210

  const baseHeight = getScarfParticipantBarHeight(
    HEIGHT_OF_BAR,
    SPACE_ABOVE_RECT,
    aoiDataLength,
    isAoiVisible,
    LINE_WRAPPED_HEIGHT
  )
  const heightOfParticipantBars = baseHeight * participantIds.length

  const heightOfLegend = getScarfLegendHeight(
    aoiDataLength + 1, // +1 for the no AOI category fixation
    HEIGHT_OF_LEGEND_BAR,
    NUMBER_PER_ROW
  )

  const heightOfLegendMovementType = getScarfLegendHeight(
    3,
    HEIGHT_OF_LEGEND_BAR,
    NUMBER_PER_ROW
  )
  const heightOfDynamicAoiLegend = isAoiVisible
    ? getScarfLegendHeight(aoiDataLength, HEIGHT_OF_LEGEND_BAR, NUMBER_PER_ROW)
    : 0

  return (
    heightOfParticipantBars +
    heightOfLegend +
    heightOfLegendMovementType +
    ADD_HEIGHT +
    heightOfDynamicAoiLegend
  )
}

/**
 * Helper function to calculate the height of the scarf grid based on the current data.
 * For the workspace component (grid view). Returns the height of the scarf grid in grid units.
 * It uses constant UNIT_OF_GRID_HEIGHT to convert the height in pixels to grid units.
 * @param stimulusId selected stimulus ID
 * @param dynamicAOI is dynamic AOI shown in the current data view?
 * @param groupId selected group ID
 * @returns the height of the scarf grid based on the current data in grid units
 */
export const getScarfGridHeightFromCurrentData = (
  stimulusId: number,
  dynamicAOI: boolean,
  groupId: number
): number => {
  const participants = getParticipants(groupId, stimulusId)
  console.log(participants)
  const aois = getAois(stimulusId)
  const UNIT_OF_GRID_HEIGHT = 50

  return Math.ceil(
    getScarfHeight(
      participants.map(participant => participant.id),
      dynamicAOI,
      aois.length
    ) / UNIT_OF_GRID_HEIGHT
  )
}

/**
 * Helper function determining whether dynamic AOI is displayed in the current context.
 * @param timeline the timeline type
 * @param dynamicAOIAllowed is dynamic AOI allowed by the settings?
 * @param dynamicAOIInData is dynamic AOI present in the current data (stimulus)?
 * @returns a boolean indicating whether dynamic AOI is allowed in the current context
 */
export const getDynamicAoiBoolean = (
  timeline: 'ordinal' | 'absolute' | 'relative',
  dynamicAOIAllowed: boolean,
  dynamicAOIInData: boolean
) => {
  return timeline === 'ordinal'
    ? false
    : !dynamicAOIAllowed
      ? false
      : dynamicAOIInData
}
