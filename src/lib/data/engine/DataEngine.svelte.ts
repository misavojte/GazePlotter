import { BinaryBufferReader, AoiGroupReader } from '../binary'
import type {
  DataType,
  ExtendedInterpretedDataType,
  ParticipantsGroup,
} from '../types'

export class DataEngine {
  // --- Private Memory (Non-Reactive) ---
  // We keep binary data outside runes to prevent proxy overhead on 8GB buffers.
  private _binary: DataType['segments'] | null = null
  private _reader: BinaryBufferReader | null = null
  private _aoiGroupReader: AoiGroupReader | null = null

  // --- Public Reactive State ---
  metadata = $state<Omit<DataType, 'segments'> | null>(null)

  hasValidData = $derived(
    !!this.metadata && this.metadata.stimuli.data.length > 0
  )

  // ==========================================
  // Core Engine Logic
  // ==========================================

  loadDataset(fullData: DataType) {
    const { segments, ...meta } = fullData
    this._binary = segments
    this._reader = new BinaryBufferReader(segments)
    this._aoiGroupReader = new AoiGroupReader(this._reader)
    this.metadata = meta
    this._aoiGroupReader.updateMap(meta)
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
      const stimulusAoiCount = meta.aois.data[stimulusId]?.length ?? 0
      const unique = Array.from(
        new Set(
          hiddenAois.filter(
            v => Number.isInteger(v) && v >= 0 && v < stimulusAoiCount
          )
        )
      ).sort((a, b) => a - b)

      while (hidden.length <= stimulusId) hidden.push([])
      hidden[stimulusId] = unique
    }

    if (this.metadata) this._aoiGroupReader?.updateMap(this.metadata)
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

    if (this.metadata) this._aoiGroupReader?.updateMap(this.metadata)
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
    return this._aoiGroupReader?.getAoiMapping(sId, rawId) ?? rawId
  }

  getReader() {
    return this._reader
  }

  getAoiGroupReader() {
    return this._aoiGroupReader
  }

  get segments() {
    return this._binary
  }
}

export const engine = new DataEngine()
