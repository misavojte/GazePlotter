import {
  BinaryBufferReader,
  type DataType,
  type ExtendedInterpretedDataType,
  type ParticipantsGroup,
  type BaseInterpretedDataType,
  type SegmentInterpretedDataType,
  DEFAULT_NO_AOI_TREATMENT,
} from '$lib/gaze-data/shared/types'

const MAX_AOI = 256

export class DataEngine {
  // --- Private Memory (Non-Reactive) ---
  // We keep binary data outside runes to prevent proxy overhead on 8GB buffers.
  private _binary: DataType['segments'] | null = null
  private _reader: BinaryBufferReader | null = null

  // --- Interpretation Cache (High Speed) ---
  // The only place where AOI grouping truth lives.
  private _aoiGroupMap = new Uint16Array(0)

  // --- Public Reactive State ---
  metadata = $state<Omit<DataType, 'segments'> | null>(null)

  hasValidData = $derived(
    !!this.metadata && this.metadata.stimuli.data.length > 0
  )

  // ==========================================
  // Core Engine Logic
  // ==========================================

  private refreshInterpretationMap() {
    if (!this.metadata) return
    const sCount = this.metadata.stimuli.data.length

    if (this._aoiGroupMap.length !== sCount * MAX_AOI) {
      this._aoiGroupMap = new Uint16Array(sCount * MAX_AOI)
    }
    this._aoiGroupMap.fill(0xffff)

    for (let sId = 0; sId < sCount; sId++) {
      const aois = this.metadata.aois.data[sId] || []
      const hidden = new Set(this.metadata.aois.hiddenAois?.[sId] ?? [])
      const nameToId = new Map<string, number>()
      const offset = sId * MAX_AOI

      // Rule: First visible AOI with a specific name becomes the Group Representative
      aois.forEach((row: string[], id: number) => {
        if (hidden.has(id)) return
        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !nameToId.has(name)) nameToId.set(name, id)
      })

      for (let id = 0; id < aois.length; id++) {
        const name = (
          this.metadata.aois.data[sId][id][1] ??
          this.metadata.aois.data[sId][id][0]
        ).trim()
        const mapped = nameToId.get(name)
        this._aoiGroupMap[offset + id] = mapped !== undefined ? mapped : id
      }
    }
  }

  // ==========================================
  // Atomic Mutators (Anti-Spike)
  // ==========================================

  loadDataset(fullData: DataType) {
    const { segments, ...meta } = fullData
    this._binary = segments
    this._reader = new BinaryBufferReader(segments)
    this.metadata = meta
    this.refreshInterpretationMap()
  }

  /**
   * Perfect Update: Shallow copies the metadata shell, deep copies ONLY
   * the branch being edited. Never touches or clones the binary buffers.
   */
  updateAois(stimulusId: number, updatedAois: ExtendedInterpretedDataType[]) {
    if (!this.metadata) return

    const nextAoiBranch = { ...this.metadata.aois }
    const nextData = [...nextAoiBranch.data]
    nextData[stimulusId] = updatedAois.map(a => [
      a.originalName,
      a.displayedName,
      a.color,
    ])

    const nextOrder = [...(nextAoiBranch.orderVector as number[][])]
    nextOrder[stimulusId] = updatedAois.map(a => a.id)

    // Atomic update triggers Svelte 5 reactivity
    this.metadata = {
      ...this.metadata,
      aois: { ...nextAoiBranch, data: nextData, orderVector: nextOrder },
    }

    this.refreshInterpretationMap() // Sync interpretation cache
  }

  setHiddenAois(stimulusId: number, hiddenAois: number[]) {
    if (!this.metadata) return

    const unique = Array.from(
      new Set(
        (hiddenAois ?? []).filter(
          v => Number.isInteger(v) && v >= 0 && v < MAX_AOI
        )
      )
    ).sort((a, b) => a - b)

    // Ensure hiddenAois array exists
    let hiddenByStimulus = this.metadata.aois.hiddenAois
    if (!hiddenByStimulus) {
      hiddenByStimulus = []
      this.metadata.aois.hiddenAois = hiddenByStimulus
    }

    // Ensure array is large enough
    while (hiddenByStimulus.length < this.metadata.stimuli.data.length) {
      hiddenByStimulus.push([])
    }

    // In-place update thanks to Svelte 5 deep reactivity
    hiddenByStimulus[stimulusId] = unique

    this.refreshInterpretationMap()
  }

  updateHiddenAoisBatch(
    updates: { stimulusId: number; hiddenAois: number[] }[]
  ) {
    if (!this.metadata) return

    let hiddenByStimulus = this.metadata.aois.hiddenAois
    if (!hiddenByStimulus) {
      hiddenByStimulus = []
      this.metadata.aois.hiddenAois = hiddenByStimulus
    }

    // Ensure array is large enough
    while (hiddenByStimulus.length < this.metadata.stimuli.data.length) {
      hiddenByStimulus.push([])
    }

    updates.forEach(({ stimulusId, hiddenAois }) => {
      const unique = Array.from(
        new Set(
          (hiddenAois ?? []).filter(
            v => Number.isInteger(v) && v >= 0 && v < MAX_AOI
          )
        )
      ).sort((a, b) => a - b)

      hiddenByStimulus[stimulusId] = unique
    })

    this.refreshInterpretationMap()
  }

  /** Generic batch updater for metadata branches */
  private updateBatch<K extends keyof Omit<DataType, 'segments'>>(
    key: K,
    updater: (current: any) => any
  ) {
    if (!this.metadata) return
    this.metadata = {
      ...this.metadata,
      [key]: updater(this.metadata[key]),
    }
  }

  updateAoisBatch(
    updates: { stimulusId: number; aois: ExtendedInterpretedDataType[] }[]
  ) {
    this.updateBatch('aois', current => {
      const next = { ...current }
      const nextData = [...next.data]
      const nextOrder = [...(next.orderVector as number[][])]
      updates.forEach(({ stimulusId, aois }) => {
        nextData[stimulusId] = aois.map(a => [
          a.originalName,
          a.displayedName,
          a.color,
        ])
        nextOrder[stimulusId] = aois.map(a => a.id)
      })
      return { ...next, data: nextData, orderVector: nextOrder }
    })
    this.refreshInterpretationMap()
  }

  updateParticipantsBatch(
    updates: { id: number; data: string[] }[],
    newOrder: number[]
  ) {
    this.updateBatch('participants', current => {
      const nextData = [...current.data]
      updates.forEach(({ id, data }) => {
        if (id >= 0 && id < nextData.length) nextData[id] = data
      })
      return { ...current, data: nextData, orderVector: newOrder }
    })
  }

  updateStimuliBatch(
    updates: { id: number; data: string[] }[],
    newOrder: number[]
  ) {
    this.updateBatch('stimuli', current => {
      const nextData = [...current.data]
      updates.forEach(({ id, data }) => {
        if (id >= 0 && id < nextData.length) nextData[id] = data
      })
      return { ...current, data: nextData, orderVector: newOrder }
    })
  }

  setNoAoiTreatment(treatment: { displayedName: string; color: string }) {
    if (!this.metadata) return
    this.metadata.noAoiTreatment = treatment
  }

  setParticipantsGroups(groups: ParticipantsGroup[]) {
    if (!this.metadata) return
    this.metadata.participantsGroups = groups
  }

  updateDynamicVisibility(
    stimulusId: number,
    updates: {
      aoiId: number
      visibility: number[]
      participantId?: number | null
    }[]
  ) {
    if (!this.metadata) return

    updates.forEach(({ aoiId, visibility, participantId }) => {
      let key = `${stimulusId}_${aoiId}`
      if (participantId != null) {
        key += `_${participantId}`
      }
      this.metadata!.aois.dynamicVisibility[key] = visibility
    })
  }

  // ==========================================
  // Hot-Path Accessors
  // ==========================================

  getAoiMapping(sId: number, rawId: number): number {
    const mapped = this._aoiGroupMap[sId * MAX_AOI + rawId]
    // If mapped is undefined (out of bounds) or 0xffff (default), return rawId
    return mapped === undefined || mapped === 0xffff ? rawId : mapped
  }

  getReader() {
    return this._reader
  }

  get segments() {
    return this._binary
  }
}

export const engine = new DataEngine()
// Constants for fast AOI mapping store
const MAX_STIMULUS = 256 // Maximum number of stimuli we can handle
const MAX_AOI_PER_STIMULUS = 256 // Maximum number of AOIs per stimulus

// ============================================================================
// PRIVATE MODULE-LEVEL STATE: The High-Performance Engine (Delegated to DataEngine)
// ============================================================================

/**
 * Checks if the data store contains valid, non-empty data.
 * @returns true if data contains valid content
 */
export const getHasValidData = (): boolean => {
  return engine.hasValidData
}

// Basic data access functions
// RETURN ENGINE STATE DIRECTLY TO PREVENT UNNECESSARY CLONING
export const getData = (): DataType => {
  if (!engine.metadata) {
    return {
      isOrdinalOnly: false,
      aois: {
        data: [],
        orderVector: [],
        dynamicVisibility: {},
        hiddenAois: [],
      },
      categories: { data: [], orderVector: [] },
      participants: { data: [], orderVector: [] },
      participantsGroups: [],
      stimuli: { data: [], orderVector: [] },
      segments: {
        segmentBuffer: new Float32Array(0),
        indexTable: new Uint32Array(0),
        aoiPool: new Uint16Array(0),
        maxParticipants: 0,
        stimuliCount: 0,
      },
      noAoiTreatment: DEFAULT_NO_AOI_TREATMENT,
    }
  }
  return { ...engine.metadata, segments: engine.segments! } as DataType
}

export const setData = (newData: DataType): void => {
  // Load into engine (source of truth)
  engine.loadDataset(newData)
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

// Helper to get hidden AOI ids for a stimulus directly from a data snapshot
const getHiddenAoisFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): number[] => {
  return dataSnapshot.aois.hiddenAois?.[stimulusId] ?? []
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
 * BACKWARD COMPATIBLE AOI ID MAPPING (Delegated to DataEngine)
 *
 * This function now performs a direct, non-reactive memory read from the DataEngine
 * interpretation cache. Zero overhead.
 *
 * @param stimulusId - The numeric ID of the stimulus
 * @param aoiId - The original AOI ID
 * @returns The mapped (representative) AOI ID, or the original ID if no mapping exists
 */
export const getAoiIdMapping = (stimulusId: number, aoiId: number): number => {
  return engine.getAoiMapping(stimulusId, aoiId)
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

export const getHiddenAois = (stimulusId: number): number[] => {
  return getData().aois.hiddenAois?.[stimulusId] ?? []
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

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const visibleAoiIds = hiddenSet
    ? aoiIds.filter(aoiId => !hiddenSet.has(aoiId))
    : aoiIds

  // Apply mapping and ensure uniqueness
  const mappedAoiIds = [
    ...new Set(visibleAoiIds.map(aoiId => getAoiIdMapping(stimulusId, aoiId))),
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

/**
 * Get the end time of the last segment for a participant on a stimulus.
 * Uses the DataEngine cached reader for optimal performance.
 *
 * @param stimulusIndex ID of the stimulus
 * @param particIndex ID of the participant
 * @returns End time of the last segment for this participant on this stimulus, or 0 if no segments
 */
export const getParticipantEndTime = (
  stimulusIndex: number,
  particIndex: number
): number => {
  const reader = engine.getReader()
  if (!reader) return 0

  return reader.getParticipantEndTime(stimulusIndex, particIndex)
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
  const reader = engine.getReader()
  if (!reader) return 0
  return reader.getSegmentCount(stimulusId, participantId)
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

export const getParticipantsIds = (groupId = -1, stimulusId = 0): number[] => {
  if (groupId === -1) {
    return getParticipantOrderVector()
  }
  if (groupId === -2) {
    return getNonEmptyParticipants(stimulusId).map(
      participant => participant.id
    )
  }
  return getParticipantsGroup(groupId).participantsIds
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
  if (!engine.metadata) return
  engine.setParticipantsGroups(groups)
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
    const mappedAoiIds: number[] = []
    const aoiCount = getData().aois.data[stimulusId]?.length ?? 0

    for (let id = 0; id < aoiCount; id++) {
      if (id === aoiId) continue // Skip the representative itself
      if (getAoiIdMapping(stimulusId, id) === mappedAoiId) {
        mappedAoiIds.push(id)
      }
    }

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
  const currentState = getData()
  const aoiData = currentState.aois.data[stimulusId]
  if (aoiData === undefined) {
    console.error(`No AOI data found for stimulusId: ${stimulusId}`)
    return
  }

  const updates: {
    aoiId: number
    visibility: number[]
    participantId?: number | null
  }[] = []

  aoiNames.forEach((aoiName, index) => {
    const aoiId = aoiData.findIndex(el => el[0] === aoiName)
    if (aoiId === -1) {
      console.warn(
        `AOI with name ${aoiName} not found for stimulusId: ${stimulusId}`
      )
      return
    }
    updates.push({ aoiId, visibility: visibilityArr[index], participantId })
  })

  if (updates.length > 0) {
    engine.updateDynamicVisibility(stimulusId, updates)
  }
}

export const updateHiddenAois = (
  stimulusId: number,
  hiddenAois: number[]
): void => {
  const currentState = getData()

  if (!currentState) {
    throw new Error('Cannot update hidden AOIs: data store is empty')
  }

  if (!currentState.aois.data[stimulusId]) {
    throw new Error(
      `Cannot update hidden AOIs: stimulus ${stimulusId} does not exist`
    )
  }

  // Use engine for fast update
  engine.setHiddenAois(stimulusId, hiddenAois)
}

/**
 * Updates hidden AOIs for a stimulus and optionally propagates the hidden/visible status
 * across all stimuli using the same strategy as AOI updates.
 *
 * - 'this_stimulus': only updates the provided stimulus
 * - 'all_by_original_name': updates all AOIs with matching original names
 * - 'all_by_displayed_name': updates all AOIs with matching displayed names (fallback to original)
 */
export const updateHiddenAoisWithPropagation = (
  stimulusId: number,
  hiddenAois: number[],
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  const currentState = getData()

  if (!currentState) {
    throw new Error('Cannot update hidden AOIs: data store is empty')
  }

  if (!currentState.aois.data[stimulusId]) {
    throw new Error(
      `Cannot update hidden AOIs: stimulus ${stimulusId} does not exist`
    )
  }

  // Sanitize input for the target stimulus
  const unique = Array.from(
    new Set(
      (hiddenAois ?? []).filter(
        v => Number.isInteger(v) && v >= 0 && v < MAX_AOI_PER_STIMULUS
      )
    )
  ).sort((a, b) => a - b)

  const updates: { stimulusId: number; hiddenAois: number[] }[] = []

  // Always update target
  updates.push({ stimulusId, hiddenAois: unique })

  if (applyTo !== 'this_stimulus') {
    const sourceAois = currentState.aois.data[stimulusId]
    const keysToHide = new Set<string>()

    unique.forEach(id => {
      const row = sourceAois?.[id]
      if (!row) return
      const originalName = row[0] ?? ''
      const displayedName = (row[1] ?? originalName) as string
      const key =
        applyTo === 'all_by_original_name'
          ? originalName
          : (displayedName || originalName).trim()
      if (key) keysToHide.add(key)
    })

    for (
      let stimIndex = 0;
      stimIndex < currentState.stimuli.data.length;
      stimIndex++
    ) {
      if (stimIndex === stimulusId) continue
      const stimAois = currentState.aois.data[stimIndex]
      if (!stimAois) continue

      const nextHidden: number[] = []
      for (let aoiId = 0; aoiId < stimAois.length; aoiId++) {
        const row = stimAois[aoiId]
        if (!row) continue
        const originalName = row[0] ?? ''
        const displayedName = (row[1] ?? originalName) as string
        const key =
          applyTo === 'all_by_original_name'
            ? originalName
            : (displayedName || originalName).trim()
        if (key && keysToHide.has(key)) {
          nextHidden.push(aoiId)
        }
      }
      updates.push({ stimulusId: stimIndex, hiddenAois: nextHidden })
    }
  }

  engine.updateHiddenAoisBatch(updates)
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
  const currentState = getData()
  if (!currentState.aois.data[stimulusId]) {
    throw new Error(
      `Stimulus with id ${stimulusId} does not exist in AOIs data`
    )
  }

  const updates: { stimulusId: number; aois: ExtendedInterpretedDataType[] }[] =
    []

  // Helper to get current AOIs as objects from data source
  const getCurrentAoisAsObjects = (sId: number) => {
    return getAoisRawFromData(sId, currentState)
  }

  // Helper to apply updates to a list of AOI objects
  const applyUpdatesToAoiList = (
    currentList: ExtendedInterpretedDataType[],
    updateLogic: (aoi: ExtendedInterpretedDataType) => void
  ) => {
    // We map to new objects to ensure isolation, then apply updates
    return currentList.map(existingAoi => {
      const newAoi = { ...existingAoi }
      updateLogic(newAoi)
      return newAoi
    })
  }

  if (applyTo === 'this_stimulus') {
    const currentList = getCurrentAoisAsObjects(stimulusId)
    // Merge specific updates
    aois.forEach(update => {
      if (update.id >= 0 && update.id < currentList.length) {
        currentList[update.id] = { ...currentList[update.id], ...update }
      }
    })
    updates.push({ stimulusId, aois: currentList })
  } else if (applyTo === 'all_by_original_name') {
    // Build lookup from input updates
    const originalNameToValues = new Map<
      string,
      { displayedName: string; color: string }
    >()
    aois.forEach(aoi => {
      originalNameToValues.set(aoi.originalName, {
        displayedName: aoi.displayedName,
        color: aoi.color,
      })
    })

    // Update target and others
    const numStimuli = currentState.stimuli.data.length
    for (let sId = 0; sId < numStimuli; sId++) {
      const currentList = getCurrentAoisAsObjects(sId)
      let modified = false

      if (sId === stimulusId) {
        // Explicit update for target stimulus
        aois.forEach(update => {
          if (update.id >= 0 && update.id < currentList.length) {
            currentList[update.id] = { ...currentList[update.id], ...update }
          }
        })
        modified = true
      } else {
        // Matching update for others
        currentList.forEach((aoi, index) => {
          const vals = originalNameToValues.get(aoi.originalName)
          if (vals) {
            currentList[index] = { ...aoi, ...vals }
            modified = true
          }
        })
      }

      if (modified) {
        updates.push({ stimulusId: sId, aois: currentList })
      }
    }
  } else if (applyTo === 'all_by_displayed_name') {
    const displayedNameToColor = new Map<string, string>()
    aois.forEach(aoi => {
      if (aoi.displayedName && aoi.displayedName.trim() !== '') {
        displayedNameToColor.set(aoi.displayedName, aoi.color)
      }
    })

    const numStimuli = currentState.stimuli.data.length
    for (let sId = 0; sId < numStimuli; sId++) {
      const currentList = getCurrentAoisAsObjects(sId)
      let modified = false

      if (sId === stimulusId) {
        aois.forEach(update => {
          if (update.id >= 0 && update.id < currentList.length) {
            currentList[update.id] = { ...currentList[update.id], ...update }
          }
        })
        modified = true
      } else {
        currentList.forEach((aoi, index) => {
          const dName = aoi.displayedName || aoi.originalName
          const color = displayedNameToColor.get(dName)
          if (color) {
            currentList[index] = { ...aoi, color }
            modified = true
          }
        })
      }

      if (modified) {
        updates.push({ stimulusId: sId, aois: currentList })
      }
    }
  }

  if (updates.length > 0) {
    engine.updateAoisBatch(updates)
  }
}

/**
 * Returns segments for a given stimulus and participant, optionally filtered by categories and/or AOIs.
 * This function is optimized for performance using the DataEngine for zero-allocation segment iteration.
 * It applies AOI ID mapping to remove duplicates and ensure grouped AOIs are treated as a single entity.
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
  const reader = engine.getReader()
  if (!reader) return []

  const range = reader.getSegmentRange(stimulusId, participantId)
  const segmentCount = range.endIndex - range.startIndex

  // Early returns for empty data
  if (segmentCount === 0) return []
  if (limit === 0) return []
  if (offset >= segmentCount) return []

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const result: SegmentInterpretedDataType[] = []

  // High-performance caches for the duration of this call
  const aoiCache: Record<number, ExtendedInterpretedDataType> = {}
  const categoryCache: Record<number, ExtendedInterpretedDataType> = {}

  // Pre-compute filter lookups
  const categoryFilter = whereCategories ? new Set(whereCategories) : null
  const aoiFilter = whereAois ? new Set(whereAois) : null

  // SHARED BUFFER optimization: Use one Set for the whole loop
  // instead of creating thousands of Sets.
  const uniqueAois = new Set<number>()

  let resultCount = 0
  const processTo = Math.min(
    range.endIndex,
    range.startIndex + offset + (limit ?? segmentCount)
  )

  for (
    let i = range.startIndex + offset;
    i < processTo && (limit === null || resultCount < limit);
    i++
  ) {
    const categoryId = reader.getSegmentCategory(i)

    // Fast category filter check
    if (categoryFilter && !categoryFilter.has(categoryId)) {
      continue
    }

    // Get raw AOI IDs as subarray view (zero allocation)
    const rawIds = reader.getRawAois(i)

    // Process AOI filter if needed
    if (aoiFilter) {
      let hasMatchingAoi = false
      for (let j = 0; j < rawIds.length; j++) {
        const rawId = rawIds[j]
        if (hiddenSet && hiddenSet.has(rawId)) continue
        const mappedId = engine.getAoiMapping(stimulusId, rawId)
        if (aoiFilter.has(mappedId)) {
          hasMatchingAoi = true
          break
        }
      }

      if (!hasMatchingAoi) {
        continue
      }
    }

    // At this point, segment passed all filters
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)

    // Clear and reuse the shared Set
    uniqueAois.clear()

    // Map and deduplicate AOI IDs
    for (let j = 0; j < rawIds.length; j++) {
      const rawId = rawIds[j]
      if (hiddenSet && hiddenSet.has(rawId)) continue
      const mappedId = engine.getAoiMapping(stimulusId, rawId)
      uniqueAois.add(mappedId)
    }

    // Convert to AOI objects using local cache to avoid thousands of allocations
    const aoi: ExtendedInterpretedDataType[] = []
    const dataSnapshot = getData()
    for (const aoiId of uniqueAois) {
      if (!aoiCache[aoiId])
        aoiCache[aoiId] = getAoiRaw(stimulusId, aoiId, dataSnapshot)
      aoi.push(aoiCache[aoiId])
    }

    if (!categoryCache[categoryId]) {
      categoryCache[categoryId] = getCategory(categoryId)
    }

    result.push({
      id: i - range.startIndex,
      start,
      end,
      aoi,
      category: categoryCache[categoryId],
    })

    resultCount++
  }

  return result
}

export const updateMultipleParticipants = (
  participants: BaseInterpretedDataType[]
): void => {
  const currentState = getData()

  const updates: { id: number; data: string[] }[] = []
  const newOrder = [...participants.map(p => p.id)]

  participants.forEach(p => {
    if (p.id >= 0 && p.id < currentState.participants.data.length) {
      updates.push({ id: p.id, data: [p.originalName, p.displayedName] })
    }
  })

  // We should also preserve order of others if we were not replacing whole list?
  // Current logic seems to replace order vector with map of participants.
  // Assuming participants contains ALL participants in new order.

  engine.updateParticipantsBatch(updates, newOrder)
}

export const updateMultipleStimuli = (
  stimuli: BaseInterpretedDataType[]
): void => {
  const currentState = getData()

  const updates: { id: number; data: string[] }[] = []
  const newOrder = [...stimuli.map(p => p.id)]

  stimuli.forEach(s => {
    if (s.id >= 0 && s.id < currentState.stimuli.data.length) {
      updates.push({ id: s.id, data: [s.originalName, s.displayedName] })
    }
  })

  engine.updateStimuliBatch(updates, newOrder)
}

export const updateNoAoiTreatment = (noAoiTreatment: {
  displayedName: string
  color: string
}): void => {
  engine.setNoAoiTreatment(noAoiTreatment)
}
