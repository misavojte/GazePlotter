import {
  type DataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { getData, getAoiIdMapping } from './baseSelectors'

const getDefaultColor = (index: number): string => {
  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dcb0f2', '#87c55f']
  return COLORS[index % COLORS.length]
}

const getAoiOrderVectorFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): number[] => {
  const order = dataSnapshot.aois.orderVector?.[stimulusId]
  if (order == null) {
    const noOfAois = dataSnapshot.aois.data[stimulusId]?.length ?? 0
    return [...Array(noOfAois).keys()]
  }
  return order
}

const getAoiRaw = (
  stimulusId: number,
  aoiId: number,
  dataSnapshot: DataType
): ExtendedInterpretedDataType => {
  const aoiArray = dataSnapshot.aois.data[stimulusId][aoiId]
  if (aoiArray === undefined)
    throw new Error(
      `AOI with id ${aoiId} does not exist in stimulus with id ${stimulusId}`
    )
  const originalName = aoiArray[0]
  const displayedName = aoiArray[1] ?? originalName
  const color = aoiArray[2] ?? getDefaultColor(aoiId)

  return {
    id: aoiId,
    originalName,
    displayedName,
    color,
  }
}

/**
 * Get all AOIs for a stimulus from a data snapshot
 */
export const getAoisRawFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVectorFromData(stimulusId, dataSnapshot)
  return aoiIds.map((aoiId: number) =>
    getAoiRaw(stimulusId, aoiId, dataSnapshot)
  )
}

export const getAoiOrderVector = (stimulusId: number): number[] => {
  return getAoiOrderVectorFromData(stimulusId, getData())
}

export const getHiddenAois = (stimulusId: number): number[] => {
  return getData().aois.hiddenAois?.[stimulusId] ?? []
}

export const getAllAois = (
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  const data = getData()
  return aoiIds.map((aoiId: number) => {
    const aoi = getAoiRaw(stimulusId, aoiId, data)
    return {
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: aoi.displayedName,
      color: aoi.color,
    }
  })
}

export const getAois = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const visibleAoiIds = hiddenSet
    ? aoiIds.filter(aoiId => !hiddenSet.has(aoiId))
    : aoiIds

  const mappedAoiIds = [
    ...new Set(visibleAoiIds.map(aoiId => getAoiIdMapping(stimulusId, aoiId))),
  ]

  const data = getData()
  return mappedAoiIds.map((aoiId: number) => getAoiRaw(stimulusId, aoiId, data))
}

export const getAoi = (
  stimulusId: number,
  aoiId: number
): ExtendedInterpretedDataType => {
  const mappedAoiId = getAoiIdMapping(stimulusId, aoiId)
  return getAoiRaw(stimulusId, mappedAoiId, getData())
}
