import {
  BinaryBufferReader,
  type DataType,
  type ExtendedInterpretedDataType,
  type ParticipantsGroup,
  type BaseInterpretedDataType,
  type SegmentInterpretedDataType,
  DEFAULT_NO_AOI_TREATMENT,
} from '$lib/gaze-data/shared/types'

import { MAX_AOI, MAX_STIMULUS } from '../const'

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
