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
const MAX_STIMULUS = 256

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

      // Use order vector to find the Group Representative (first visible in user-defined order)
      const order =
        this.metadata.aois.orderVector?.[sId] ||
        Array.from({ length: aois.length }, (_, i) => i)

      order.forEach((id: number) => {
        const row = aois[id]
        if (!row || hidden.has(id)) return
        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !nameToId.has(name)) nameToId.set(name, id)
      })

      for (let id = 0; id < aois.length; id++) {
        const row = aois[id]
        if (!row) continue
        const name = (row[1] ?? row[0]).trim()
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

    // Update data at original indices (do NOT reorder nextData)
    const stimulusData = [...nextData[stimulusId]]
    updatedAois.forEach(a => {
      if (a.id >= 0 && a.id < stimulusData.length) {
        stimulusData[a.id] = [a.originalName, a.displayedName, a.color]
      }
    })
    nextData[stimulusId] = stimulusData

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
    updater: (
      current: Omit<DataType, 'segments'>[K]
    ) => Omit<DataType, 'segments'>[K]
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
        if (stimulusId >= 0 && stimulusId < nextData.length) {
          const stimulusData = [...nextData[stimulusId]]
          aois.forEach(a => {
            if (a.id >= 0 && a.id < stimulusData.length) {
              stimulusData[a.id] = [a.originalName, a.displayedName, a.color]
            }
          })
          nextData[stimulusId] = stimulusData
          nextOrder[stimulusId] = aois.map(a => a.id)
        }
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

// ==========================================
// Atomic Mutators (Anti-Spike)
// ==========================================

export const setData = (newData: DataType): void => {
  // Load into engine (source of truth)
  engine.loadDataset(newData)
}

export const updateParticipantsGroups = (groups: ParticipantsGroup[]) => {
  if (!engine.metadata) return
  engine.setParticipantsGroups(groups)
}

export const updateMultipleAoiVisibility = (
  stimulusId: number,
  aoiNames: string[],
  visibilityArr: number[][],
  participantId: number | null = null
): void => {
  const currentState = engine.metadata
  if (!currentState) return
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
  // Delegate to engine
  engine.setHiddenAois(stimulusId, hiddenAois)
}

/**
 * Updates hidden AOIs for a stimulus and optionally propagates the hidden/visible status
 * across all stimuli.
 */
export const updateHiddenAoisWithPropagation = (
  stimulusId: number,
  hiddenAois: number[],
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  const currentState = engine.metadata
  if (!currentState) return

  if (!currentState.aois.data[stimulusId]) {
    throw new Error(
      `Cannot update hidden AOIs: stimulus ${stimulusId} does not exist`
    )
  }

  const unique = Array.from(
    new Set(
      (hiddenAois ?? []).filter(
        v => Number.isInteger(v) && v >= 0 && v < MAX_AOI
      )
    )
  ).sort((a, b) => a - b)

  const updates: { stimulusId: number; hiddenAois: number[] }[] = []
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
 * Internal helper to get all AOIs for a stimulus from a metadata snapshot
 */
const getAoisRawFromMetadata = (
  stimulusId: number,
  metadata: Omit<DataType, 'segments'>
): ExtendedInterpretedDataType[] => {
  const order = metadata.aois.orderVector?.[stimulusId]
  const aoiIds = order ?? [
    ...Array(metadata.aois.data[stimulusId]?.length ?? 0).keys(),
  ]

  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dCB0F2', '#87c55f']

  return aoiIds.map((aoiId: number) => {
    const row = metadata.aois.data[stimulusId][aoiId]
    const originalName = row[0]
    const displayedName = row[1] ?? originalName
    const color = row[2] ?? COLORS[aoiId % COLORS.length]
    return { id: aoiId, originalName, displayedName, color }
  })
}

/**
 * Updates multiple AOIs for a stimulus with optional propagation to other stimuli.
 */
export const updateMultipleAoi = (
  aois: ExtendedInterpretedDataType[],
  stimulusId: number,
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  const meta = engine.metadata
  if (!meta || !meta.aois.data[stimulusId]) {
    return
  }

  const updates: { stimulusId: number; aois: ExtendedInterpretedDataType[] }[] =
    []

  if (applyTo === 'this_stimulus') {
    let currentList = getAoisRawFromMetadata(stimulusId, meta)
    if (aois.length >= currentList.length) {
      currentList = aois
    } else {
      const updateMap = new Map(aois.map(a => [a.id, a]))
      currentList = currentList.map(a => {
        const update = updateMap.get(a.id)
        return update ? { ...a, ...update } : a
      })
    }
    updates.push({ stimulusId, aois: currentList })
  } else if (applyTo === 'all_by_original_name') {
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

    const numStimuli = meta.stimuli.data.length
    for (let sId = 0; sId < numStimuli; sId++) {
      let currentList = getAoisRawFromMetadata(sId, meta)
      let modified = false

      if (sId === stimulusId) {
        if (aois.length >= currentList.length) {
          currentList = aois
        } else {
          const updateMap = new Map(aois.map(a => [a.id, a]))
          currentList = currentList.map(a => {
            const update = updateMap.get(a.id)
            return update ? { ...a, ...update } : a
          })
        }
        modified = true
      } else {
        currentList = currentList.map(aoi => {
          const vals = originalNameToValues.get(aoi.originalName)
          if (vals) {
            modified = true
            return { ...aoi, ...vals }
          }
          return aoi
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

    const numStimuli = meta.stimuli.data.length
    for (let sId = 0; sId < numStimuli; sId++) {
      let currentList = getAoisRawFromMetadata(sId, meta)
      let modified = false

      if (sId === stimulusId) {
        if (aois.length >= currentList.length) {
          currentList = aois
        } else {
          const updateMap = new Map(aois.map(a => [a.id, a]))
          currentList = currentList.map(a => {
            const update = updateMap.get(a.id)
            return update ? { ...a, ...update } : a
          })
        }
        modified = true
      } else {
        currentList = currentList.map(aoi => {
          const dName = aoi.displayedName || aoi.originalName
          const color = displayedNameToColor.get(dName)
          if (color) {
            modified = true
            return { ...aoi, color }
          }
          return aoi
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

export const updateMultipleParticipants = (
  participants: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates: { id: number; data: string[] }[] = []
  const newOrder = [...participants.map(p => p.id)]

  participants.forEach(p => {
    if (p.id >= 0 && p.id < meta.participants.data.length) {
      updates.push({ id: p.id, data: [p.originalName, p.displayedName] })
    }
  })

  engine.updateParticipantsBatch(updates, newOrder)
}

export const updateMultipleStimuli = (
  stimuli: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates: { id: number; data: string[] }[] = []
  const newOrder = [...stimuli.map(p => p.id)]

  stimuli.forEach(s => {
    if (s.id >= 0 && s.id < meta.stimuli.data.length) {
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
