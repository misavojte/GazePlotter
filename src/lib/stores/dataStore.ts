import { writable, get, derived } from 'svelte/store'
import type { Writable, Readable } from 'svelte/store'
import type { DataType } from '$lib/type/Data/DataType'
import { demoData } from '$lib/const/demoDataTwo'
import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType'
import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup'

// Initialize the main data store
export const getDemoDataWritable = (): Writable<DataType> => {
  return writable<DataType>(demoData)
}
export const data = getDemoDataWritable()

// Basic data access functions
export const getData = (): DataType => {
  return get(data)
}

export const setData = (newData: DataType): void => {
  data.set(newData)
  // No need to manually update mappings as the derived store will handle it
}

export const getNumberOfStimuli = (): number => {
  return getData().stimuli.data.length
}

export const getNumberOfParticipants = (): number => {
  return getData().participants.data.length
}

// Helper functions for AOI data access
const getDefaultColor = (index: number): string => {
  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dcb0f2', '#87c55f']
  return COLORS[index % COLORS.length]
}

// Helper to get the order vector for a stimulus directly from data
const getAoiOrderVectorFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): number[] => {
  const order = dataSnapshot.aois.orderVector?.[stimulusId]
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order == null) {
    const noOfAois = dataSnapshot.aois.data[stimulusId].length
    return [...Array(noOfAois).keys()]
  }
  return order
}

// Helper function to get AOI data without applying mapping
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

// Get all AOIs for a stimulus from a data snapshot
const getAoisRawFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVectorFromData(stimulusId, dataSnapshot)
  return aoiIds.map((aoiId: number) =>
    getAoiRaw(stimulusId, aoiId, dataSnapshot)
  )
}

// Create a derived store for AOI ID mappings
// This will automatically update whenever the data store changes
const aoiIdMappings: Readable<{
  [stimulusId: number]: { [aoiId: number]: number }
}> = derived(data, $data => {
  const mappings: { [stimulusId: number]: { [aoiId: number]: number } } = {}
  const stimuliCount = $data.stimuli.data.length

  // Process each stimulus
  for (let stimulusId = 0; stimulusId < stimuliCount; stimulusId++) {
    try {
      const aois = getAoisRawFromData(stimulusId, $data)
      const nameToFirstId = new Map<string, number>()
      const mapping: { [aoiId: number]: number } = {}

      // First pass: find first occurrence of each displayed name
      aois.forEach(aoi => {
        if (
          !nameToFirstId.has(aoi.displayedName) &&
          aoi.displayedName.trim() !== ''
        ) {
          nameToFirstId.set(aoi.displayedName, aoi.id)
        }
      })

      // Second pass: create mapping
      aois.forEach(aoi => {
        if (
          aoi.displayedName.trim() !== '' &&
          nameToFirstId.has(aoi.displayedName)
        ) {
          mapping[aoi.id] = nameToFirstId.get(aoi.displayedName)!
        } else {
          mapping[aoi.id] = aoi.id // Self-map for AOIs without grouping
        }
      })

      mappings[stimulusId] = mapping
    } catch (e) {
      // In case of any error, use identity mapping
      const noOfAois = $data.aois.data[stimulusId]?.length || 0
      const identityMapping: { [aoiId: number]: number } = {}
      for (let i = 0; i < noOfAois; i++) {
        identityMapping[i] = i
      }
      mappings[stimulusId] = identityMapping
    }
  }

  return mappings
})

// Helper to get AOI ID mapping
export const getAoiIdMapping = (stimulusId: number, aoiId: number): number => {
  const mappings = get(aoiIdMappings)
  return mappings[stimulusId]?.[aoiId] ?? aoiId
}

// Public API functions
export const getAoiOrderVector = (stimulusId: number): number[] => {
  const order = getData().aois.orderVector?.[stimulusId]
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order == null) {
    const noOfAois = getData().aois.data[stimulusId].length
    return [...Array(noOfAois).keys()]
  }
  return order
}

export const getStimuliOrderVector = (): number[] => {
  const order = getData().stimuli.orderVector
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order.length === 0) {
    const noOfStimuli = getData().stimuli.data.length
    return [...Array(noOfStimuli).keys()]
  }
  return order
}

export const getParticipantOrderVector = (): number[] => {
  const order = getData().participants.orderVector
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order.length === 0) {
    const noOfParticipants = getData().participants.data.length
    return [...Array(noOfParticipants).keys()]
  }
  return order
}

// Get raw AOIs without applying ID mapping (using current data)
const getAoisRaw = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  return aoiIds.map((aoiId: number) => getAoiRaw(stimulusId, aoiId, getData()))
}

/**
 * Returns all AOIs for a stimulus, including duplicates with the same displayed name.
 * This should be used in UI components that need to edit all AOIs individually.
 */
export const getAllAois = (
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  return aoiIds.map((aoiId: number) => getAoiRaw(stimulusId, aoiId, getData()))
}

/**
 * Returns AOIs for a stimulus with groups consolidated.
 * AOIs with the same displayed name will appear as a single AOI.
 * This should be used for visualization components.
 */
export const getAois = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)

  // Apply mapping and ensure uniqueness
  const mappedAoiIds = [
    ...new Set(aoiIds.map(aoiId => getAoiIdMapping(stimulusId, aoiId))),
  ]

  return mappedAoiIds.map((aoiId: number) =>
    getAoiRaw(stimulusId, aoiId, getData())
  )
}

/**
 * Returns the stimulus with the given id
 * @param id - id of the stimulus
 * @returns BaseInterpretedDataType
 * @throws Error if stimulus with given id does not exist
 */
export const getStimulus = (id: number): BaseInterpretedDataType => {
  const stimulusArray = getData().stimuli.data[id]
  if (stimulusArray === undefined)
    throw new Error('Stimulus with this id does not exist')
  const originalName = stimulusArray[0]
  const displayedName = stimulusArray[1] ?? originalName
  return {
    id,
    originalName,
    displayedName,
  }
}

export const getStimuli = (): BaseInterpretedDataType[] => {
  const stimuliIds = getStimuliOrderVector()
  return stimuliIds.map((stimulusId: number) => getStimulus(stimulusId))
}

export const getStimulusHighestEndTime = (stimulusIndex: number): number => {
  let max = 0
  for (
    let participantIndex = 0;
    participantIndex < getNumberOfParticipants();
    participantIndex++
  ) {
    const lastSegmentEndTime = getParticipantEndTime(
      stimulusIndex,
      participantIndex
    )
    max = lastSegmentEndTime > max ? (max = lastSegmentEndTime) : max
  }
  return max
}

export const getParticipantEndTime = (
  stimulusIndex: number,
  particIndex: number
): number => {
  const segmentsInfo = getData().segments[stimulusIndex][particIndex]
  return segmentsInfo === undefined
    ? 0
    : segmentsInfo.length > 0
      ? segmentsInfo[segmentsInfo.length - 1][1]
      : 0
}

export const getParticipant = (id: number): BaseInterpretedDataType => {
  const participantArray = getData().participants.data[id]
  if (participantArray === undefined)
    throw new Error('Participant with this id does not exist')
  const originalName = participantArray[0]
  const displayedName = participantArray[1] ?? originalName
  return {
    id,
    displayedName,
    originalName,
  }
}

export const getAoi = (
  stimulusId: number,
  aoiId: number
): ExtendedInterpretedDataType => {
  // Map the aoiId to the representative ID (first one with same displayed name)
  const mappedAoiId = getAoiIdMapping(stimulusId, aoiId)

  // Use the mapped ID to get the AOI data
  return getAoiRaw(stimulusId, mappedAoiId, getData())
}

export const getCategory = (id: number): ExtendedInterpretedDataType => {
  const categoryArray = getData().categories.data[id]
  if (categoryArray === undefined)
    throw new Error(`Category with id ${id} does not exist`)
  const originalName = categoryArray[0]
  const displayedName = categoryArray[1] ?? originalName
  const color = categoryArray[2] ?? '#626262'
  return {
    id,
    originalName,
    displayedName,
    color,
  }
}

export const getSegment = (
  stimulusId: number,
  participantId: number,
  id: number
): SegmentInterpretedDataType => {
  const segmentArray = getData().segments[stimulusId][participantId][id]
  if (segmentArray === undefined)
    throw new Error(
      `Segment with id ${id} does not exist in stimulus with id ${stimulusId} and participant with id ${participantId}`
    )
  const start = segmentArray[0]
  const end = segmentArray[1]

  // Get AOI IDs and apply mapping to remove duplicates
  const aoiIds = getSortedAoiIdsByOrderVector(stimulusId, segmentArray.slice(3))

  // Use a Set to ensure uniqueness after mapping
  const mappedAoiIds = [
    ...new Set(aoiIds.map(aoiId => getAoiIdMapping(stimulusId, aoiId))),
  ]

  const aoi = mappedAoiIds.map((aoiId: number) =>
    getAoiRaw(stimulusId, aoiId, getData())
  )
  const categoryId = segmentArray[2]
  const category = getCategory(categoryId)
  return {
    id,
    start,
    end,
    aoi,
    category,
  }
}

/**
 * Returns given array of aoi ids sorted by its order vector.
 * @param stimulusId - id of the stimulus as AOIs are stimulus specific (thus, order vectors too)
 * @param aoiIds - array of aoi ids to be sorted
 */
const getSortedAoiIdsByOrderVector = (
  stimulusId: number,
  aoiIds: number[]
): number[] => {
  const orderVector = getAoiOrderVector(stimulusId)
  return aoiIds.sort((a, b) => orderVector.indexOf(a) - orderVector.indexOf(b))
}

export const getNumberOfSegments = (
  stimulusId: number,
  participantId: number
): number => {
  return getData().segments[stimulusId][participantId]?.length ?? 0
}

/**
 * Get all participants of given group ID.
 * Only groups with non-negative ID truly exist.
 * Values -1 and -2 are used for "All participants" and "Non-empty participants" default groups.
 * @param groupId Id of participants group. If not provided, -1 is used as default value
 * @returns participants of given group
 * @throws Error if group with given id does not exist and is not -1 or -2
 */
export const getParticipants = (
  groupId = -1,
  stimulusId = 0
): BaseInterpretedDataType[] => {
  if (groupId === -1) {
    return getAllParticipants()
  }
  if (groupId === -2) {
    console.log('non empty')
    return getNonEmptyParticipants(stimulusId)
  }
  const group = getParticipantsGroup(groupId)
  const participantsIds = getParticipantOrderVector()
  const groupParticipantsIds = participantsIds.filter(participantId =>
    group.participantsIds.includes(participantId)
  )
  return groupParticipantsIds.map(participantId =>
    getParticipant(participantId)
  )
}

export const getAllParticipants = (): BaseInterpretedDataType[] => {
  const participantsIds = getParticipantOrderVector()
  return participantsIds.map((participantId: number) =>
    getParticipant(participantId)
  )
}

export const getNonEmptyParticipants = (
  stimulusId: number
): BaseInterpretedDataType[] => {
  const participantsIds = getParticipantOrderVector()
  const nonEmptyParticipantsIds = participantsIds.filter(
    participantId => getNumberOfSegments(stimulusId, participantId) > 0
  )
  return nonEmptyParticipantsIds.map(participantId =>
    getParticipant(participantId)
  )
}

export const getParticipantsGroups = (
  isDefault = false,
  stimulusId = 0
): ParticipantsGroup[] => {
  const defaultGroups: ParticipantsGroup[] = []
  if (isDefault) {
    defaultGroups.push({
      id: -1,
      name: 'All participants',
      participantsIds: getParticipantOrderVector(),
    })
    defaultGroups.push({
      id: -2,
      name: 'Non-empty',
      participantsIds: getNonEmptyParticipants(stimulusId).map(
        participant => participant.id
      ),
    })
  }
  return [...defaultGroups, ...getData().participantsGroups]
}

export const getParticipantsGroup = (groupId: number): ParticipantsGroup => {
  const group = getParticipantsGroups().find(group => group.id === groupId)
  if (group === undefined) {
    throw new Error(`Participants group with id ${groupId} does not exist`)
  }
  return group
}

export const updateParticipantsGroups = (groups: ParticipantsGroup[]) => {
  data.update(data => {
    data.participantsGroups = groups
    return data
  })
}

/**
 * Returns the visibility of the AOI for the given stimulus and participant.
 * Remember the AOI dynamic visibility are stored under the key "stimulusId_aoiId_participantId"
 * @param stimulusId numeric id of the stimulus
 * @param aoiId numeric id of the AOI for the given stimulus (notice that AOI ids are stimulus specific)
 * @param participantId numeric id of the participant (these are global for all stimuli)
 * @returns
 */
export const getAoiVisibility = (
  stimulusId: number,
  aoiId: number,
  participantId: number | null = null
): number[] | null => {
  const baseKey = `${stimulusId}_${aoiId}`
  let result = getData().aois.dynamicVisibility[baseKey] ?? null
  if (participantId != null) {
    const extendedKey = `${baseKey}_${participantId}`
    result = getData().aois.dynamicVisibility[extendedKey] ?? result
  }
  return result
}

/**
 * Returns boolean value indicating if the AOI has any visibility set for the given stimulus.
 * Remember the AOI dynamic visibility are stored under the key "stimulusId_aoiId_participantId".
 * Thus, we need to check if there is any key starting with "stimulusId_".
 * @param stimulusId numeric id of the stimulus
 * @returns boolean value indicating if the AOI has any visibility set for the given stimulus
 */
export const hasStimulusAoiVisibility = (stimulusId: number): boolean => {
  return Object.keys(getData().aois.dynamicVisibility).some(key =>
    key.startsWith(`${stimulusId}_`)
  )
}

export const updateMultipleAoiVisibility = (
  stimulusId: number,
  aoiNames: string[],
  visibilityArr: number[][],
  participantId: number | null = null
): void => {
  data.update(currentData => {
    const aoiData = currentData.aois.data[stimulusId]
    if (aoiData === undefined) {
      console.error(`No AOI data found for stimulusId: ${stimulusId}`)
      return currentData // No update if no AOI data found
    }

    aoiNames.forEach((aoiName, index) => {
      const aoiId = aoiData.findIndex(el => el[0] === aoiName)
      if (aoiId === -1) {
        console.warn(
          `AOI with name ${aoiName} not found for stimulusId: ${stimulusId}`
        )
        return // Continue to next AOI name if current one not found
      }

      let key = `${stimulusId}_${aoiId}`
      if (participantId != null) {
        key += `_${participantId}`
      }

      currentData.aois.dynamicVisibility[key] = visibilityArr[index]
    })

    return currentData
  })
}

export const updateMultipleAoi = (
  aoi: ExtendedInterpretedDataType[],
  stimulusId: number,
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  console.log('updateMultipleAoi', aoi)
  data.update(data => {
    if (data.aois.data[stimulusId] === undefined) {
      throw new Error(
        `Stimulus with id ${stimulusId} does not exist in AOIs data`
      )
    }
    if (aoi.length !== data.aois.data[stimulusId].length) {
      throw new Error(
        `Number of AOIs in stimulus with id ${stimulusId} does not match number of AOIs in given array`
      )
    }
    aoi.forEach(aoi => {
      const aoiArray = [aoi.originalName, aoi.displayedName, aoi.color]
      if (data.aois.data[stimulusId][aoi.id] === undefined) {
        throw new Error(
          `AOI with id ${aoi.id} does not exist in stimulus with id ${stimulusId}`
        )
      }
      data.aois.data[stimulusId][aoi.id] = aoiArray
    })
    // Update order vector, only for this stimulus
    data.aois.orderVector[stimulusId] = aoi.map(aoi => aoi.id)

    if (applyTo === 'all_by_original_name') {
      const originalNames = aoi.map(aoi => aoi.originalName)
      const displayedNames = aoi.map(aoi => aoi.displayedName)
      const colors = aoi.map(aoi => aoi.color)
      const noOfStimuli = data.stimuli.data.length
      for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
        const aois = data.aois.data[stimulusId]
        for (const aoi of aois) {
          if (aoi === undefined) continue
          const originalName = aoi[0]
          if (originalNames.includes(originalName)) {
            const index = originalNames.indexOf(originalName)
            aoi[1] = displayedNames[index]
            aoi[2] = colors[index]
          }
        }
        // No need to manually update mappings anymore
      }
    }
    if (applyTo === 'all_by_displayed_name') {
      const displayedNames = aoi.map(aoi => aoi.displayedName)
      const colors = aoi.map(aoi => aoi.color)
      const noOfStimuli = data.stimuli.data.length
      for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
        const aois = data.aois.data[stimulusId]
        for (const aoi of aois) {
          if (aoi === undefined) continue
          const displayedName = aoi[1]
          if (displayedNames.includes(displayedName)) {
            const index = displayedNames.indexOf(displayedName)
            aoi[1] = displayedNames[index]
            aoi[2] = colors[index]
          }
        }
        // No need to manually update mappings anymore
      }
    }

    // No need to manually update mappings anymore, as the derived store will handle it
    return data
  })
}
