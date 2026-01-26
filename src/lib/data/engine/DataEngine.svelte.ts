import {
  BinaryBufferReader,
  type DataType,
  type ExtendedInterpretedDataType,
  type ParticipantsGroup,
} from '$lib/data/types'

import { MAX_AOI } from '../constants'

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
    const meta = this.metadata
    if (!meta) return
    const sCount = meta.stimuli.data.length

    if (this._aoiGroupMap.length !== sCount * MAX_AOI) {
      this._aoiGroupMap = new Uint16Array(sCount * MAX_AOI)
    }
    this._aoiGroupMap.fill(0xffff)

    for (let sId = 0; sId < sCount; sId++) {
      const aois = meta.aois.data[sId] || []
      const hidden = meta.aois.hiddenAois?.[sId]
      const hiddenSet = hidden && hidden.length ? new Set(hidden) : null
      const nameToId = new Map<string, number>()
      const offset = sId * MAX_AOI

      const order =
        meta.aois.orderVector?.[sId] ||
        Array.from({ length: aois.length }, (_, i) => i)

      for (let i = 0; i < order.length; i++) {
        const id = order[i]
        const row = aois[id]
        if (!row || hiddenSet?.has(id)) continue
        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !nameToId.has(name)) nameToId.set(name, id)
      }

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

  updateAois(stimulusId: number, updatedAois: ExtendedInterpretedDataType[]) {
    this.updateAoisBatch([{ stimulusId, aois: updatedAois }])
  }

  setHiddenAois(stimulusId: number, hiddenAois: number[]) {
    this.updateHiddenAoisBatch([{ stimulusId, hiddenAois }])
  }

  updateHiddenAoisBatch(
    updates: { stimulusId: number; hiddenAois: number[] }[]
  ) {
    const meta = this.metadata
    if (!meta) return

    if (!meta.aois.hiddenAois) meta.aois.hiddenAois = []
    const hidden = meta.aois.hiddenAois

    for (let i = 0; i < updates.length; i++) {
      const { stimulusId, hiddenAois } = updates[i]
      const unique = Array.from(
        new Set(
          hiddenAois.filter(v => Number.isInteger(v) && v >= 0 && v < MAX_AOI)
        )
      ).sort((a, b) => a - b)

      while (hidden.length <= stimulusId) hidden.push([])
      hidden[stimulusId] = unique
    }

    this.refreshInterpretationMap()
  }

  updateAoisBatch(
    updates: { stimulusId: number; aois: ExtendedInterpretedDataType[] }[]
  ) {
    const meta = this.metadata
    if (!meta) return

    for (let i = 0; i < updates.length; i++) {
      const { stimulusId, aois } = updates[i]
      if (stimulusId < 0 || stimulusId >= meta.aois.data.length) continue

      const stimulusData = meta.aois.data[stimulusId]
      for (let j = 0; j < aois.length; j++) {
        const a = aois[j]
        if (a.id >= 0 && a.id < stimulusData.length) {
          stimulusData[a.id] = [a.originalName, a.displayedName, a.color]
        }
      }

      if (!meta.aois.orderVector) meta.aois.orderVector = []
      while (meta.aois.orderVector.length <= stimulusId)
        meta.aois.orderVector.push([])
      meta.aois.orderVector[stimulusId] = aois.map(a => a.id)
    }

    this.refreshInterpretationMap()
  }

  updateParticipantsBatch(
    updates: { id: number; data: string[] }[],
    newOrder: number[]
  ) {
    const meta = this.metadata
    if (!meta) return
    for (let i = 0; i < updates.length; i++) {
      const { id, data } = updates[i]
      if (id >= 0 && id < meta.participants.data.length)
        meta.participants.data[id] = data
    }
    meta.participants.orderVector = newOrder
  }

  updateStimuliBatch(
    updates: { id: number; data: string[] }[],
    newOrder: number[]
  ) {
    const meta = this.metadata
    if (!meta) return
    for (let i = 0; i < updates.length; i++) {
      const { id, data } = updates[i]
      if (id >= 0 && id < meta.stimuli.data.length) meta.stimuli.data[id] = data
    }
    meta.stimuli.orderVector = newOrder
  }

  setNoAoiTreatment(treatment: { displayedName: string; color: string }) {
    if (this.metadata) this.metadata.noAoiTreatment = treatment
  }

  setParticipantsGroups(groups: ParticipantsGroup[]) {
    if (this.metadata) this.metadata.participantsGroups = groups
  }

  updateDynamicVisibility(
    stimulusId: number,
    updates: {
      aoiId: number
      visibility: number[]
      participantId?: number | null
    }[]
  ) {
    const meta = this.metadata
    if (!meta) return

    for (let i = 0; i < updates.length; i++) {
      const { aoiId, visibility, participantId } = updates[i]
      let key = `${stimulusId}_${aoiId}`
      if (participantId != null) key += `_${participantId}`
      meta.aois.dynamicVisibility[key] = visibility
    }
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
