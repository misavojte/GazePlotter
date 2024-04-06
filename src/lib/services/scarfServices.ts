import { getAois, getParticipants } from '$lib/stores/dataStore.ts'

export const getScarfLegendHeight = (
  length: number,
  height: number,
  numberPerRow: number
) => {
  return height * (length / numberPerRow)
}

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

  const baseHeight = getScarfParticipantBarHeight(
    HEIGHT_OF_BAR,
    SPACE_ABOVE_RECT,
    aoiDataLength,
    isAoiVisible,
    LINE_WRAPPED_HEIGHT
  )
  const heightOfParticipantBars = baseHeight * participantIds.length

  const heightOfLegend = getScarfLegendHeight(
    aoiDataLength + 1,
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
    180 +
    heightOfDynamicAoiLegend
  )
}

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
