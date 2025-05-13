import { writable, get, derived } from 'svelte/store'
import type { Writable, Readable } from 'svelte/store'
import type {
  DataType,
  BaseInterpretedDataType,
  ExtendedInterpretedDataType,
  SegmentInterpretedDataType,
  ParticipantsGroup,
} from '$lib/gaze-data/shared/types'
import { demoData } from '$lib/gaze-data/front-process/const/demoDataTwo'

// Constants for fast AOI mapping store
const MAX_STIMULUS = 256 // Maximum number of stimuli we can handle
const MAX_AOI_PER_STIMULUS = 256 // Maximum number of AOIs per stimulus

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

  // Return a new object to ensure no reference sharing
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
  // Create a new array with each AOI to prevent reference sharing
  return aoiIds.map((aoiId: number) =>
    getAoiRaw(stimulusId, aoiId, dataSnapshot)
  )
}

/**
 * A derived Svelte store that maintains mappings from original AOI IDs to their representative IDs.
 *
 * This store automatically updates whenever the underlying data changes. It maps each AOI ID
 * to the ID of the first AOI that shares the same displayed name. This allows AOIs with the
 * same displayed name to be treated as a single group in visualizations.
 *
 * The mapping follows these rules:
 * - AOIs with the same displayed name map to the ID of the first AOI with that name
 * - AOIs with unique displayed names or empty names map to their own ID (self-mapping)
 * - The mapping is maintained per stimulus
 *
 * Format: { [stimulusId]: { [aoiId]: mappedAoiId } }
 */
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

/**
 * High-performance AOI ID mapping store using TypedArrays
 *
 * This store uses a flat Uint16Array to store all AOI mappings for ultra-fast lookups:
 * - Each stimulus has a fixed-size block of MAX_AOI_PER_STIMULUS entries
 * - Access pattern: mappingArray[stimulusId * MAX_AOI_PER_STIMULUS + aoiId]
 * - Value of 65535 (0xFFFF) indicates no mapping exists (fallback to identity)
 *
 * This structure eliminates object creation and property access during lookups
 * for maximum performance in hot paths like segment rendering.
 */
const fastAoiIdMappings: Readable<{
  array: Uint16Array // The actual mapping data
  stimuliCount: number // Number of stimuli with mappings
  aoiCounts: Uint16Array // Number of AOIs per stimulus (for bound checking)
}> = derived(data, $data => {
  const stimuliCount = Math.min($data.stimuli.data.length, MAX_STIMULUS)

  // Create a single TypedArray for all mappings
  // Size: stimuliCount * MAX_AOI_PER_STIMULUS entries
  const array = new Uint16Array(stimuliCount * MAX_AOI_PER_STIMULUS)

  // Track AOI counts per stimulus for bounds checking
  const aoiCounts = new Uint16Array(stimuliCount)

  // Initialize with identity mapping (each AOI maps to itself)
  array.fill(0xffff) // Use 0xFFFF (65535) as sentinel for "no mapping"

  // Process each stimulus
  for (let stimulusId = 0; stimulusId < stimuliCount; stimulusId++) {
    try {
      // Get all AOIs for this stimulus
      const aois = getAoisRawFromData(stimulusId, $data)
      aoiCounts[stimulusId] = aois.length

      // Skip if no AOIs for this stimulus
      if (!aois.length) continue

      // First pass: find first occurrence of each displayed name
      const nameToFirstId = new Map<string, number>()

      for (const aoi of aois) {
        if (
          !nameToFirstId.has(aoi.displayedName) &&
          aoi.displayedName.trim() !== ''
        ) {
          nameToFirstId.set(aoi.displayedName, aoi.id)
        }
      }

      // Calculate offset for this stimulus in the flat array
      const offset = stimulusId * MAX_AOI_PER_STIMULUS

      // Second pass: populate the mapping array
      for (const aoi of aois) {
        if (
          aoi.displayedName.trim() !== '' &&
          nameToFirstId.has(aoi.displayedName)
        ) {
          array[offset + aoi.id] = nameToFirstId.get(aoi.displayedName)!
        } else {
          array[offset + aoi.id] = aoi.id // Self-map for AOIs without grouping
        }
      }
    } catch (e) {
      // On error, use identity mapping (each AOI maps to itself)
      const noOfAois = $data.aois.data[stimulusId]?.length || 0
      aoiCounts[stimulusId] = noOfAois

      const offset = stimulusId * MAX_AOI_PER_STIMULUS
      for (let i = 0; i < noOfAois; i++) {
        array[offset + i] = i
      }
    }
  }

  return {
    array,
    stimuliCount,
    aoiCounts,
  }
})

/**
 * Fast AOI ID mapping lookup using TypedArrays.
 *
 * This function provides the same functionality as getAoiIdMapping but with
 * significantly higher performance for hot code paths. It uses a flat TypedArray
 * with direct indexing to eliminate object property lookups and reduce GC pressure.
 *
 * @param stimulusId - The numeric ID of the stimulus
 * @param aoiId - The original AOI ID
 * @returns The mapped (representative) AOI ID, or the original ID if no mapping exists
 */
export const getAoiIdMapping = (stimulusId: number, aoiId: number): number => {
  const { array, stimuliCount, aoiCounts } = get(fastAoiIdMappings)

  // Bounds checking for maximum performance
  if (
    stimulusId < 0 ||
    stimulusId >= stimuliCount ||
    aoiId < 0 ||
    aoiId >= aoiCounts[stimulusId] ||
    aoiId >= MAX_AOI_PER_STIMULUS
  ) {
    return aoiId // Return identity mapping for out-of-bounds indices
  }

  // Direct index calculation for O(1) access
  const index = stimulusId * MAX_AOI_PER_STIMULUS + aoiId
  const mappedId = array[index]

  // Check for sentinel value (no mapping)
  return mappedId === 0xffff ? aoiId : mappedId
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

/* // Get raw AOIs without applying ID mapping (using current data)
const getAoisRaw = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  return aoiIds.map((aoiId: number) => getAoiRaw(stimulusId, aoiId, getData()))
} */

/**
 * Returns all AOIs for a stimulus, including duplicates with the same displayed name.
 *
 * This function returns the complete set of AOIs without any grouping applied.
 * It should be used in UI components that need to edit all AOIs individually,
 * such as the AOI modification panel.
 *
 * Each AOI is returned as a new object to prevent reference sharing.
 *
 * @param stimulusId - The numeric ID of the stimulus
 * @returns An array of all AOIs for the given stimulus
 */
export const getAllAois = (
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  // Create a new array with deep-copied AOIs
  return aoiIds.map((aoiId: number) => {
    const aoi = getAoiRaw(stimulusId, aoiId, getData())
    // Explicitly create a new object to prevent reference sharing
    return {
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: aoi.displayedName,
      color: aoi.color,
    }
  })
}

/**
 * Returns AOIs for a stimulus with groups consolidated.
 *
 * This function returns a deduplicated set of AOIs where those with the same
 * displayed name appear as a single AOI. This should be used for visualization
 * components where grouped AOIs need to be treated as a single entity.
 *
 * The consolidation works as follows:
 * 1. For each AOI ID, get its mapped (representative) ID
 * 2. Remove duplicate mapped IDs to ensure each group appears only once
 * 3. Return the AOI data for each unique representative ID
 *
 * @param stimulusId - The numeric ID of the stimulus
 * @returns An array of deduplicated AOIs for the given stimulus
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
  segmentId: number
): SegmentInterpretedDataType => {
  const segments = getSegments(
    stimulusId,
    participantId,
    null,
    null,
    1,
    segmentId
  )
  if (segments.length === 0) {
    throw new Error(
      `Segment ${segmentId} not found for stimulus ${stimulusId} and participant ${participantId}`
    )
  }
  return segments[0]
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
    // Create a deep copy of the groups to avoid reference sharing
    data.participantsGroups = structuredClone(groups)
    return data
  })
}

/**
 * Returns the visibility of the AOI for the given stimulus and participant.
 *
 * When AOIs are grouped (same displayed name), it merges visibility data from all AOIs in the group.
 * The visibility data consists of an array of toggle points where AOI visibility changes
 * from visible to invisible or vice versa. The array should have an even number of elements,
 * with each pair representing a time range (visible from first time to second time).
 *
 * @param stimulusId - Numeric ID of the stimulus
 * @param aoiId - Numeric ID of the AOI
 * @param participantId - Optional numeric ID of the participant (if null, global visibility is used)
 * @returns An array of timestamps where visibility toggles (on to off or off to on), or null if no visibility data exists
 */
export const getAoiVisibility = (
  stimulusId: number,
  aoiId: number,
  participantId: number | null = null
): number[] | null => {
  const mappedAoiId = getAoiIdMapping(stimulusId, aoiId)

  // First, try to find direct visibility data for the mapped AOI ID
  const baseKey = `${stimulusId}_${mappedAoiId}`
  let result = getData().aois.dynamicVisibility[baseKey] ?? null

  if (participantId != null) {
    // Try participant-specific visibility for the mapped AOI ID
    const extendedKey = `${baseKey}_${participantId}`
    result = getData().aois.dynamicVisibility[extendedKey] ?? result
  }

  // If this is a grouped AOI (where other AOIs map to this one),
  // we need to merge visibility from all AOIs in the group
  if (mappedAoiId === aoiId) {
    // This is the representative AOI for a group
    // Get all AOI IDs that map to this representative ID
    const mappings = get(aoiIdMappings)
    const mappedAoiIds = Object.entries(mappings[stimulusId] || {})
      .filter(
        ([_id, mappedId]) => mappedId === mappedAoiId && Number(_id) !== aoiId
      )
      .map(([id]) => Number(id))

    // If there are other AOIs mapped to this one, merge their visibility data
    if (mappedAoiIds.length > 0) {
      // Collect all visibility toggle arrays
      const allVisibilities: (number[] | null)[] = result ? [result] : []

      for (const otherAoiId of mappedAoiIds) {
        // Try to get visibility for the other AOI
        const otherKey = `${stimulusId}_${otherAoiId}`
        let otherVisibility = getData().aois.dynamicVisibility[otherKey] ?? null

        if (participantId != null) {
          // Try participant-specific visibility for the other AOI
          const otherExtendedKey = `${otherKey}_${participantId}`
          otherVisibility =
            getData().aois.dynamicVisibility[otherExtendedKey] ??
            otherVisibility
        }

        // Add to the collection if it exists
        if (otherVisibility) {
          allVisibilities.push(otherVisibility)
        }
      }

      console.log('allVisibilities', allVisibilities)

      // If we have multiple visibility arrays to merge
      if (allVisibilities.length > 0) {
        // Convert each visibility array to ranges (start, end)
        const ranges: Array<[number, number]> = []

        for (const visibility of allVisibilities) {
          if (!visibility || visibility.length === 0) continue

          // Make sure the visibility array is sorted
          const sortedVisibility = [...visibility].sort((a, b) => a - b)

          // Process toggle points into ranges
          for (let i = 0; i < sortedVisibility.length; i += 2) {
            const start = sortedVisibility[i]
            // If we have an odd number of toggles, use a very large number as the end
            const end =
              i + 1 < sortedVisibility.length
                ? sortedVisibility[i + 1]
                : Number.MAX_SAFE_INTEGER

            ranges.push([start, end])
          }
        }

        if (ranges.length === 0) {
          return null
        }

        // Sort ranges by start time
        ranges.sort((a, b) => a[0] - b[0])

        // Merge overlapping ranges
        const mergedRanges: Array<[number, number]> = []
        let currentRange = ranges[0]

        for (let i = 1; i < ranges.length; i++) {
          const nextRange = ranges[i]

          // Check for overlap or adjacency (considering floating point precision)
          if (
            nextRange[0] <= currentRange[1] ||
            Math.abs(nextRange[0] - currentRange[1]) < 1e-10
          ) {
            // Extend current range if needed
            currentRange[1] = Math.max(currentRange[1], nextRange[1])
          } else {
            // No overlap, add current range and move to next
            mergedRanges.push([...currentRange])
            currentRange = nextRange
          }
        }

        // Add the last range
        mergedRanges.push([...currentRange])

        // Convert merged ranges back to toggle points
        const mergedToggles: number[] = []
        for (const [start, end] of mergedRanges) {
          mergedToggles.push(start)
          // Only add end toggle if it's not "infinity"
          if (end < Number.MAX_SAFE_INTEGER) {
            mergedToggles.push(end)
          }
        }

        result = mergedToggles
      }
    }
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

/**
 * Updates multiple AOIs for a stimulus with optional propagation to other stimuli.
 *
 * @param aois - Array of AOIs with updated properties
 * @param stimulusId - ID of the stimulus to update
 * @param applyTo - Strategy for applying changes:
 *   - 'this_stimulus': Only update the specified stimulus
 *   - 'all_by_original_name': Update AOIs with matching original names across all stimuli
 *   - 'all_by_displayed_name': Update AOIs with matching displayed names across all stimuli
 */
export const updateMultipleAoi = (
  aois: ExtendedInterpretedDataType[],
  stimulusId: number,
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  console.log('updateMultipleAoi', { aois, stimulusId, applyTo })

  // Get current data state
  const currentState = get(data)

  // Validate inputs
  if (!currentState.aois.data[stimulusId]) {
    throw new Error(
      `Stimulus with id ${stimulusId} does not exist in AOIs data`
    )
  }

  // Create a brand new deep copy to avoid any reference issues
  const newState = structuredClone(currentState)

  // EXTREME ISOLATION FOR SINGLE STIMULUS UPDATES
  if (applyTo === 'this_stimulus') {
    // Create an entirely new data object for this specific stimulus
    const newAoiData = [...newState.aois.data]

    // Create a new array for this specific stimulus
    newAoiData[stimulusId] = [...newAoiData[stimulusId]]

    // Update each AOI in isolation
    aois.forEach(aoi => {
      if (aoi.id >= 0 && aoi.id < newAoiData[stimulusId].length) {
        // Create a brand new array for each AOI to ensure complete isolation
        newAoiData[stimulusId][aoi.id] = [
          aoi.originalName,
          aoi.displayedName,
          aoi.color,
        ]
      }
    })

    // Update order vector
    const newOrderVector = { ...newState.aois.orderVector }
    newOrderVector[stimulusId] = [...aois.map(aoi => aoi.id)]

    // Create a completely new state object
    const finalState = {
      ...newState,
      aois: {
        ...newState.aois,
        data: newAoiData,
        orderVector: newOrderVector,
      },
    }

    // Set the entire state at once
    data.set(finalState)
    return
  }

  // Handle 'all_by_original_name' and 'all_by_displayed_name' cases
  if (applyTo === 'all_by_original_name') {
    // Create lookup maps for names to values
    const originalNameToValues = new Map<
      string,
      { displayedName: string; color: string }
    >()

    // Populate maps with values from the target stimulus
    aois.forEach(aoi => {
      originalNameToValues.set(aoi.originalName, {
        displayedName: aoi.displayedName,
        color: aoi.color,
      })
    })

    // Update the target stimulus first
    aois.forEach(aoi => {
      newState.aois.data[stimulusId][aoi.id] = [
        aoi.originalName,
        aoi.displayedName,
        aoi.color,
      ]
    })

    // Update order vector
    newState.aois.orderVector[stimulusId] = [...aois.map(aoi => aoi.id)]

    // Then update other stimuli based on original name
    for (let i = 0; i < newState.stimuli.data.length; i++) {
      if (i === stimulusId) continue // Skip the already updated stimulus

      const stimAois = newState.aois.data[i]
      if (!stimAois) continue

      for (let j = 0; j < stimAois.length; j++) {
        const aoiArray = stimAois[j]
        if (!aoiArray) continue

        const originalName = aoiArray[0]
        const values = originalNameToValues.get(originalName)

        if (values) {
          // Create a new array to ensure no reference sharing
          stimAois[j] = [originalName, values.displayedName, values.color]
        }
      }
    }
  } else if (applyTo === 'all_by_displayed_name') {
    // Create lookup for displayed names to colors
    const displayedNameToColor = new Map<string, string>()

    // Populate lookup
    aois.forEach(aoi => {
      if (aoi.displayedName && aoi.displayedName.trim() !== '') {
        displayedNameToColor.set(aoi.displayedName, aoi.color)
      }
    })

    // Update the target stimulus first
    aois.forEach(aoi => {
      newState.aois.data[stimulusId][aoi.id] = [
        aoi.originalName,
        aoi.displayedName,
        aoi.color,
      ]
    })

    // Update order vector
    newState.aois.orderVector[stimulusId] = [...aois.map(aoi => aoi.id)]

    // Then update other stimuli based on displayed name
    for (let i = 0; i < newState.stimuli.data.length; i++) {
      if (i === stimulusId) continue // Skip the already updated stimulus

      const stimAois = newState.aois.data[i]
      if (!stimAois) continue

      for (let j = 0; j < stimAois.length; j++) {
        const aoiArray = stimAois[j]
        if (!aoiArray) continue

        const displayedName = aoiArray[1] || aoiArray[0] // Fallback to original name
        const color = displayedNameToColor.get(displayedName)

        if (color) {
          // Create a new array with the updated color but preserving other fields
          stimAois[j] = [aoiArray[0], aoiArray[1], color]
        }
      }
    }
  }

  // Set the entire state at once
  data.set(newState)
}

/**
 * Returns segments for a given stimulus and participant, optionally filtered by categories and/or AOIs.
 * This function is optimized for performance using direct array access and minimal object creation.
 * It applies AOI ID mapping to remove duplicates and ensure grouped AOIs are treated as a single entity.
 *
 * We avoid using .splice() and similar more readable methods to avoid unnecessary allocations as
 * this is frequently called function with a lot of querying.
 *
 * @param stimulusId - The numeric ID of the stimulus
 * @param participantId - The numeric ID of the participant
 * @param whereCategories - Optional array of category IDs to filter by. If null, all categories are included.
 * @param whereAois - Optional array of AOI IDs to filter by. If null, all AOIs are included.
 * @param limit - Optional maximum number of segments to return. If null, all matching segments are returned.
 * @param offset - Optional starting index for the segments
 * @returns Array of SegmentInterpretedDataType matching the criteria, limited by the limit parameter if provided
 */
export const getSegments = (
  stimulusId: number,
  participantId: number,
  whereCategories: number[] | null = null,
  whereAois: number[] | null = null,
  limit: number | null = null,
  offset: number = 0
): SegmentInterpretedDataType[] => {
  // Get current data snapshot - do this only once
  const currentData = getData()
  const segmentsInfo = currentData.segments[stimulusId]?.[participantId]

  // Early returns for empty data
  if (!segmentsInfo || segmentsInfo.length === 0) return []
  if (limit === 0) return []
  if (offset >= segmentsInfo.length) return []

  // Pre-allocate result array with estimated capacity
  const segmentsLength = segmentsInfo.length
  const estimatedResultSize =
    limit !== null
      ? Math.min(segmentsLength - offset, limit)
      : segmentsLength - offset
  const result: SegmentInterpretedDataType[] = []
  result.length = estimatedResultSize // Pre-allocate space for better memory efficiency
  result.length = 0 // Reset length but keep allocated memory

  // Pre-compute category filter lookup for O(1) checks
  const categoryFilter = whereCategories ? new Set(whereCategories) : null

  // Pre-compute AOI filter lookup for O(1) checks
  const aoiFilter = whereAois ? new Set(whereAois) : null

  // Cache frequently-used objects for reuse
  const {
    array: mappingArray,
    stimuliCount,
    aoiCounts,
  } = get(fastAoiIdMappings)
  const mappingOffset = stimulusId * MAX_AOI_PER_STIMULUS
  const orderVector = getAoiOrderVector(stimulusId)

  // Create a single reusable Set for deduplication
  const uniqueAoiIds = new Set<number>()

  // Fast path: if no filters are applied, return all segments (possibly limited)
  if (!categoryFilter && !aoiFilter) {
    // Determine how many segments to process
    const processCount =
      limit !== null
        ? Math.min(segmentsLength - offset, limit)
        : segmentsLength - offset

    const processTo = offset + processCount
    for (let i = offset; i < processTo; i++) {
      const segmentArray = segmentsInfo[i]
      const start = segmentArray[0]
      const end = segmentArray[1]
      const categoryId = segmentArray[2]

      // Access AOI IDs directly from the segment array (start at index 3)
      // const aoiRawIds = segmentArray.slice(3)
      // const aoiCount = aoiRawIds.length
      const aoiCount = segmentArray.length - 3

      // Clear the Set for reuse instead of creating a new one
      uniqueAoiIds.clear()

      // First collect and sort by order vector (avoiding temp arrays)
      const sortedIds: number[] = []

      // Apply the order vector sorting
      for (let j = 0; j < orderVector.length; j++) {
        const orderedId = orderVector[j]
        // Check if orderedId exists in the segment array (starting from index 3)
        let exists = false
        for (let k = 3; k < segmentArray.length; k++) {
          if (segmentArray[k] === orderedId) {
            exists = true
            break
          }
        }
        if (exists) {
          sortedIds.push(orderedId)
        }
      }

      // Then map and deduplicate in a single pass
      for (let j = 0; j < sortedIds.length; j++) {
        const aoiId = sortedIds[j]

        // Fast mapping via TypedArray
        let mappedId = aoiId
        if (
          stimulusId < stimuliCount &&
          aoiId < aoiCounts[stimulusId] &&
          aoiId < MAX_AOI_PER_STIMULUS
        ) {
          const mappedValue = mappingArray[mappingOffset + aoiId]
          mappedId = mappedValue === 0xffff ? aoiId : mappedValue
        }

        uniqueAoiIds.add(mappedId)
      }

      // Convert the unique IDs to AOI objects (unavoidable allocation)
      const aoi = Array.from(uniqueAoiIds).map(aoiId =>
        getAoiRaw(stimulusId, aoiId, currentData)
      )

      // Get category (unavoidable allocation)
      const category = getCategory(categoryId)

      // Add the segment to results
      result.push({
        id: i,
        start,
        end,
        aoi,
        category,
      })
    }
    return result
  }

  // Filtered path with early termination
  let resultCount = 0
  for (
    let i = offset;
    i < segmentsLength && (limit === null || resultCount < limit);
    i++
  ) {
    const segmentArray = segmentsInfo[i]
    const categoryId = segmentArray[2]

    // Fast category filter check
    if (categoryFilter && !categoryFilter.has(categoryId)) {
      continue // Skip if category doesn't match filter
    }

    // Process AOI filter if needed
    if (aoiFilter) {
      // Access AOI IDs directly from segmentArray starting at index 3
      // const aoiRawIds = segmentArray.slice(3)
      let hasMatchingAoi = false

      // Early exit optimization: check each AOI until we find a match
      for (let j = 3; j < segmentArray.length; j++) {
        const aoiId = segmentArray[j]

        // Fast mapping via TypedArray
        let mappedId = aoiId
        if (
          stimulusId < stimuliCount &&
          aoiId < aoiCounts[stimulusId] &&
          aoiId < MAX_AOI_PER_STIMULUS
        ) {
          const mappedValue = mappingArray[mappingOffset + aoiId]
          mappedId = mappedValue === 0xffff ? aoiId : mappedValue
        }

        if (aoiFilter.has(mappedId)) {
          hasMatchingAoi = true
          break // Found a match, no need to check more
        }
      }

      if (!hasMatchingAoi) {
        continue // Skip if no matching AOIs found
      }
    }

    // At this point, the segment has passed all filters
    const start = segmentArray[0]
    const end = segmentArray[1]

    // Access AOI IDs directly from the segment array
    // const aoiRawIds = segmentArray.slice(3)

    // Clear the Set for reuse instead of creating a new one
    uniqueAoiIds.clear()

    // First collect and sort by order vector (avoiding temp arrays)
    const sortedIds: number[] = []

    // Apply the order vector sorting
    for (let j = 0; j < orderVector.length; j++) {
      const orderedId = orderVector[j]
      // Check if orderedId exists in the segment array (starting from index 3)
      let exists = false
      for (let k = 3; k < segmentArray.length; k++) {
        if (segmentArray[k] === orderedId) {
          exists = true
          break
        }
      }
      if (exists) {
        sortedIds.push(orderedId)
      }
    }

    // Then map and deduplicate in a single pass
    for (let j = 0; j < sortedIds.length; j++) {
      const aoiId = sortedIds[j]

      // Fast mapping via TypedArray
      let mappedId = aoiId
      if (
        stimulusId < stimuliCount &&
        aoiId < aoiCounts[stimulusId] &&
        aoiId < MAX_AOI_PER_STIMULUS
      ) {
        const mappedValue = mappingArray[mappingOffset + aoiId]
        mappedId = mappedValue === 0xffff ? aoiId : mappedValue
      }

      uniqueAoiIds.add(mappedId)
    }

    // Convert the unique IDs to AOI objects (unavoidable allocation)
    const aoi = Array.from(uniqueAoiIds).map(aoiId =>
      getAoiRaw(stimulusId, aoiId, currentData)
    )

    // Get category (unavoidable allocation)
    const category = getCategory(categoryId)

    // Add the segment to results
    result.push({
      id: i,
      start,
      end,
      aoi,
      category,
    })

    resultCount++
  }

  return result
}

export const updateMultipleParticipants = (
  participants: BaseInterpretedDataType[]
): void => {
  console.log('updateMultipleParticipants', { participants })

  // Get current data state
  const currentState = get(data)

  // Create a brand new deep copy to avoid any reference issues
  const newState = structuredClone(currentState)

  // Create a new array for participants data
  const newParticipantsData = [...newState.participants.data]

  // Update each participant in isolation
  participants.forEach(participant => {
    if (participant.id >= 0 && participant.id < newParticipantsData.length) {
      // Create a brand new array for each participant to ensure complete isolation
      newParticipantsData[participant.id] = [
        participant.originalName,
        participant.displayedName,
      ]
    }
  })

  // Update order vector
  const newOrderVector = [...participants.map(participant => participant.id)]

  // Create a completely new state object
  const finalState = {
    ...newState,
    participants: {
      ...newState.participants,
      data: newParticipantsData,
      orderVector: newOrderVector,
    },
  }

  // Set the entire state at once
  data.set(finalState)
}

export const updateMultipleStimuli = (
  stimuli: BaseInterpretedDataType[]
): void => {
  console.log('updateMultipleStimuli', { stimuli })

  // Get current data state
  const currentState = get(data)

  // Create a brand new deep copy to avoid any reference issues
  const newState = structuredClone(currentState)

  // Update each stimulus in isolation
  stimuli.forEach(stimulus => {
    if (stimulus.id >= 0 && stimulus.id < newState.stimuli.data.length) {
      // Create a brand new array for each stimulus to ensure complete isolation
      newState.stimuli.data[stimulus.id] = [
        stimulus.originalName,
        stimulus.displayedName,
      ]
    }
  })

  // Update order vector
  newState.stimuli.orderVector = [...stimuli.map(stimulus => stimulus.id)]

  // Set the entire state at once
  data.set(newState)
}
