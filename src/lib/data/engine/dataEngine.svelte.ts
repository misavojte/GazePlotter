import { BinaryBufferReader, AoiGroupReader, EventBufferReader } from '../binary'
import type {
  DataCapabilityRequirements,
  DataCapabilities,
  DataType,
  EngineMetadata,
  ExtendedInterpretedDataType,
  MetricInstance,
  ParticipantsGroup,
} from '../types'
import { createMetricInstance } from '$lib/metrics/instances'
import type { Projection } from '$lib/metrics/core/projection'

export class DataEngine {
  // --- Private Memory (Non-Reactive) ---
  // We keep binary data outside runes to prevent proxy overhead on large
  // buffers. Segments AND event occurrences both live here; only their light
  // metadata (defs, order, hidden) rides in the reactive `metadata` below.
  private _binary: DataType['segments'] | null = null
  private _reader: BinaryBufferReader | null = null
  private _aoiGroupReader: AoiGroupReader | null = null
  private _eventReader = new EventBufferReader()

  // --- Public Reactive State ---
  metadata = $state<EngineMetadata | null>(null)

  /**
   * Bumps on every change to the binary event occurrence buffers (load,
   * `updateEventDataBatch`). Reactive consumers that read occurrences through
   * the non-reactive `_eventReader` depend on this so they recompute when the
   * buffers change — the event analogue of mutating `$state` metadata while
   * the heavy data sits in a reader. Channel def/order/hidden edits flow
   * through `metadata.eventData` and need no bump.
   */
  eventVersion = $state(0)

  hasValidData = $derived(
    !!this.metadata && this.metadata.stimuli.data.length > 0
  )

  capabilities = $derived.by((): DataCapabilities => {
    if (!this.metadata) {
      return {
        segmented: false,
        spatial: false,
        event: false,
      }
    }

    return this.metadata.capabilities
  })

  /** Per-stimulus boolean: true if that stimulus has any event occurrences. */
  eventsPerStimulus = $derived.by((): boolean[] => {
    void this.eventVersion
    return this._eventReader.presencePerStimulus()
  })

  // ==========================================
  // Core Engine Logic
  // ==========================================

  loadDataset(fullData: DataType) {
    const { segments, eventData, ...rest } = fullData
    this._binary = segments
    this._reader = new BinaryBufferReader(segments)
    this._aoiGroupReader = new AoiGroupReader(this._reader)
    // Heavy occurrence buffers go binary + non-reactive; only the channel
    // metadata stays in runes (same split as segments vs aois.data).
    this._eventReader.load(eventData.events)
    const meta: EngineMetadata = {
      ...rest,
      eventData: {
        data: eventData.data,
        orderVector: eventData.orderVector,
        hiddenChannels: eventData.hiddenChannels,
      },
    }
    this.metadata = meta
    this.eventVersion++
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
      const unique = hiddenAois
        .filter(
          (v, i, self) =>
            Number.isInteger(v) &&
            v >= 0 &&
            v < stimulusAoiCount &&
            self.indexOf(v) === i
        )
        .sort((a, b) => a - b)

      while (hidden.length <= stimulusId) hidden.push([])
      hidden[stimulusId] = unique
    }

    // updateMap is the single decision point: it rebuilds groupPool, diffs
    // against the previous one, and bumps `_version` only on real change.
    // Callers don't need to detect no-op cases.
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

    // updateMap is the single decision point — see updateHiddenAoisBatch.
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

  setMetricInstances(instances: MetricInstance[]) {
    if (this.metadata) this.metadata.metricInstances = instances
  }

  updateMetricInstanceLabel(id: string, label: string) {
    const meta = this.metadata
    if (!meta) return
    const trimmed = label.trim()
    if (trimmed.length === 0) return
    const idx = meta.metricInstances.findIndex(i => i.id === id)
    if (idx < 0) return
    meta.metricInstances[idx] = {
      ...meta.metricInstances[idx],
      label: trimmed,
    }
  }

  addMetricInstance(
    baseId: string,
    params: Record<string, unknown>,
    label: string | undefined,
    projection: Projection,
  ): string | null {
    const meta = this.metadata
    if (!meta) return null
    const inst = createMetricInstance({ baseId, params, projection, label })
    if (!inst) return null
    meta.metricInstances = [...(meta.metricInstances ?? []), inst]
    return inst.id
  }

  deleteMetricInstance(id: string): void {
    const meta = this.metadata
    if (!meta) return
    meta.metricInstances = (meta.metricInstances ?? []).filter(i => i.id !== id)
  }

  updateEventDataBatch(
    updates: {
      stimulusId: number
      channelDefs: string[][]
      eventBuffers: number[][][]
      orderVector?: number[]
    }[]
  ) {
    const meta = this.metadata
    if (!meta) return

    const ed = meta.eventData
    // The occurrence buffers are binary + non-reactive, so a mutation
    // reconstructs the full nested form, overlays the changed stimuli, and
    // rebuilds the reader wholesale — the AoiGroupReader.updateMap pattern.
    // Events change only on import / interval derivation / deletion, never in
    // a render loop, so the rebuild cost is irrelevant.
    const events = this._eventReader.toJson()
    for (let i = 0; i < updates.length; i++) {
      const { stimulusId, channelDefs, eventBuffers, orderVector } = updates[i]
      while (ed.data.length <= stimulusId) ed.data.push([])
      while (events.length <= stimulusId) events.push([])
      ed.data[stimulusId] = channelDefs
      events[stimulusId] = eventBuffers

      // Replacing the defs invalidates every channel id referring into
      // them, so the engine owns the reset: order falls back to identity
      // and the hidden list is cleared. Callers that want either to
      // survive must supply ids valid for the NEW defs.
      if (!ed.orderVector) ed.orderVector = []
      while (ed.orderVector.length <= stimulusId) ed.orderVector.push([])
      ed.orderVector[stimulusId] =
        orderVector && orderVector.length === channelDefs.length
          ? [...orderVector]
          : channelDefs.map((_, idx) => idx)

      if (!ed.hiddenChannels) ed.hiddenChannels = []
      while (ed.hiddenChannels.length <= stimulusId) ed.hiddenChannels.push([])
      ed.hiddenChannels[stimulusId] = []
    }

    this._eventReader.load(events)
    this.eventVersion++
    meta.capabilities.event = this._eventReader.hasAnyEvents()
  }

  updateEventChannelsBatch(
    updates: { stimulusId: number; channels: ExtendedInterpretedDataType[] }[]
  ) {
    const meta = this.metadata
    if (!meta) return

    const ed = meta.eventData
    for (let i = 0; i < updates.length; i++) {
      const { stimulusId, channels } = updates[i]
      if (!ed.data[stimulusId]) continue

      const stimulusData = ed.data[stimulusId]
      for (let j = 0; j < channels.length; j++) {
        const ch = channels[j]
        const id = ch.id
        if (id >= 0 && id < stimulusData.length) {
          // Preserve anything beyond [original, displayed, color] — e.g.
          // the derived-interval marker at index 3.
          stimulusData[id] = [
            ch.originalName,
            ch.displayedName,
            ch.color,
            ...stimulusData[id].slice(3),
          ]
        }
      }

      if (!ed.orderVector) ed.orderVector = []
      while (ed.orderVector.length <= stimulusId) ed.orderVector.push([])
      ed.orderVector[stimulusId] = channels.map(ch => ch.id)
    }
  }

  setHiddenEventChannels(stimulusId: number, hiddenIds: number[]) {
    const meta = this.metadata
    if (!meta) return

    const ed = meta.eventData
    if (!ed.hiddenChannels) ed.hiddenChannels = []
    while (ed.hiddenChannels.length <= stimulusId) ed.hiddenChannels.push([])

    const channelCount = ed.data[stimulusId]?.length ?? 0
    ed.hiddenChannels[stimulusId] = hiddenIds
      .filter(
        (v, i, self) =>
          Number.isInteger(v) &&
          v >= 0 &&
          v < channelCount &&
          self.indexOf(v) === i
      )
      .sort((a, b) => a - b)
  }

  // ==========================================
  // Hot-Path Accessors
  // ==========================================

  /**
   * Checks whether the dataset satisfies the requested capabilities.
   *
   * Evaluation rules:
   * - The top-level array is AND.
   * - A string item is a direct requirement.
   * - A nested array item is OR, where any matching capability satisfies it.
   *
   * Examples:
   * - `['segmented']` -> requires segmented data.
   * - `['segmented', 'spatial']` -> requires both segmented and spatial data.
   * - `[['spatial', 'event'], 'segmented']` -> requires segmented data and either spatial or event data.
   */
  hasCapabilities(
    requirements: DataCapabilityRequirements | undefined
  ): boolean {
    if (!requirements || requirements.length === 0) return true
    const caps = this.capabilities
    return requirements.every(requirement => {
      if (Array.isArray(requirement)) {
        return requirement.some(key => caps[key])
      }

      return caps[requirement]
    })
  }

  getAoiMapping(sId: number, rawId: number): number {
    return this._aoiGroupReader?.getAoiMapping(sId, rawId) ?? rawId
  }

  getReader() {
    return this._reader
  }

  getAoiGroupReader() {
    return this._aoiGroupReader
  }

  /** Non-reactive binary event occurrence store (see {@link EventBufferReader}). */
  getEventReader() {
    return this._eventReader
  }

  /**
   * Reconstruct the serializable `number[][][][]` event buffers from the
   * binary store — the wire shape export/round-trip expects, the inverse of
   * the strip performed in {@link loadDataset}.
   */
  getEventBuffersJson(): number[][][][] {
    return this._eventReader.toJson()
  }

  get segments() {
    return this._binary
  }
}
