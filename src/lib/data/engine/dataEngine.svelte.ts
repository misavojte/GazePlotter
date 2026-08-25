import { BinaryBufferReader, AoiGroupReader, EventBufferReader } from '../binary'
import {
  mergeParticipants as applyParticipantMerge,
  unmergeParticipants as applyParticipantUnmerge,
} from '../merge/mergeParticipants'
import {
  mergeStimuli as applyStimulusMerge,
  unmergeStimuli as applyStimulusUnmerge,
} from '../merge/mergeStimuli'
import { stimulusMediaStore } from '../media/mediaStore.svelte'
import type {
  NameSelection,
  DataCapabilityRequirements,
  DataCapabilities,
  DataType,
  EngineMetadata,
  EventDataUpdate,
  ExtendedInterpretedDataType,
  MergeLogEntry,
  MetricInstance,
  ParticipantsSelection,
  EntitySelection,
  StimulusMedia,
} from '../types'

export class DataEngine {
  // --- Private Memory (Non-Reactive) ---
  // We keep binary data outside runes to prevent proxy overhead on large
  // buffers. Segments AND event occurrences both live here; only their light
  // metadata (defs, order) rides in the reactive `metadata` below.
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
   * the heavy data sits in a reader. Channel def/order edits flow
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
      },
    }
    this.metadata = meta
    this.eventVersion++
    this._aoiGroupReader.updateMap(meta)
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

    // updateMap is the single decision point: it rebuilds groupPool, diffs
    // against the previous one, and bumps `_version` only on real change.
    // Callers don't need to detect no-op cases.
    if (this.metadata) this._aoiGroupReader?.updateMap(this.metadata)
  }

  /** Replace `[originalName, displayedName]` rows + display order for one axis
   *  (stimuli or participants — same table shape, one implementation). */
  updateEntityBatch(
    table: 'stimuli' | 'participants',
    updates: { id: number; data: string[] }[],
    newOrder: number[]
  ) {
    const meta = this.metadata
    if (!meta) return
    for (let i = 0; i < updates.length; i++) {
      const { id, data } = updates[i]
      if (id >= 0 && id < meta[table].data.length) meta[table].data[id] = data
    }
    meta[table].orderVector = newOrder
  }

  /**
   * Set or remove one stimulus's reference medium. Metadata rides in
   * `metadata.stimuliMedia`; the bytes go to the non-reactive
   * {@link stimulusMediaStore}. The record is deleted when it empties, so a
   * media-less workspace exports without the field (and as plain JSON).
   */
  setStimulusMedia(
    stimulusId: number,
    media: StimulusMedia | null,
    blob?: Blob | null
  ) {
    const meta = this.metadata
    if (!meta) return
    if (media && blob) {
      if (!meta.stimuliMedia) meta.stimuliMedia = {}
      meta.stimuliMedia[stimulusId] = media
      stimulusMediaStore.setBlob(stimulusId, blob)
    } else {
      if (meta.stimuliMedia) {
        delete meta.stimuliMedia[stimulusId]
        if (Object.keys(meta.stimuliMedia).length === 0)
          delete meta.stimuliMedia
      }
      stimulusMediaStore.remove(stimulusId)
    }
  }

  /**
   * Reset the media byte store for a freshly loaded dataset: clear, seed the
   * given blobs, and drop any `stimuliMedia` entry whose bytes are missing
   * (invariant: metadata entry ⇔ stored blob). Called by the ingest apply —
   * NOT by {@link loadDataset}, which merge/unmerge also run through and
   * which must keep the blobs (they are keyed by tombstoned, stable ids).
   * Returns how many entries were dropped, for the caller's warning toast.
   */
  setStimulusMediaBlobs(blobs: Record<number, Blob> | undefined): number {
    stimulusMediaStore.clear()
    const meta = this.metadata
    const media = meta?.stimuliMedia
    if (!meta || !media) return 0
    let dropped = 0
    for (const key of Object.keys(media)) {
      const id = Number(key)
      const blob = blobs?.[id]
      if (blob) {
        stimulusMediaStore.setBlob(id, blob)
      } else {
        delete media[id]
        dropped++
      }
    }
    if (Object.keys(media).length === 0) delete meta.stimuliMedia
    return dropped
  }

  setNoAoiTreatment(treatment: { displayedName: string; color: string }) {
    if (this.metadata) this.metadata.noAoiTreatment = treatment
  }

  setParticipantsSelections(selections: ParticipantsSelection[]) {
    if (this.metadata) this.metadata.participantsSelections = selections
  }

  setStimuliSelections(selections: EntitySelection[]) {
    if (this.metadata) this.metadata.stimuliSelections = selections
  }

  setCategoriesSelections(selections: EntitySelection[]) {
    if (this.metadata) this.metadata.categoriesSelections = selections
  }

  setEventsSelections(selections: NameSelection[]) {
    if (this.metadata) this.metadata.eventsSelections = selections
  }

  /** Replace the named AOI SELECTIONS wholesale (see {@link NameSelection}).
   *  Metadata-only; does NOT touch the AoiGroupReader/groupPool or its
   *  structural version, so a selection edit never invalidates the metric
   *  result-cache bucket (only per-selection cache keys differ). */
  setAoiSelections(selections: NameSelection[]) {
    if (this.metadata) this.metadata.aois.selections = selections
  }

  /**
   * Replaces the metric library wholesale. Only the `updateMetricInstances`
   * workspace command handler calls this at runtime — rename/create/delete/
   * reorder are array deltas dispatched through the command bus (undo/redo +
   * redraw epoch bump), never direct engine mutations.
   */
  setMetricInstances(instances: MetricInstance[]) {
    if (this.metadata) this.metadata.metricInstances = instances
  }

  updateEventDataBatch(updates: EventDataUpdate[]) {
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
      // them, so the engine owns the reset: order falls back to identity.
      // Callers that want it to survive must supply ids valid for the
      // NEW defs.
      if (!ed.orderVector) ed.orderVector = []
      while (ed.orderVector.length <= stimulusId) ed.orderVector.push([])
      ed.orderVector[stimulusId] =
        orderVector && orderVector.length === channelDefs.length
          ? [...orderVector]
          : channelDefs.map((_, idx) => idx)
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

  /**
   * Reconstruct the full serializable {@link DataType} from the reactive
   * metadata + the non-reactive binary stores — the inverse of the strip in
   * {@link loadDataset}. Used by the merge path and available to export.
   */
  toDataType(): DataType | null {
    const meta = this.metadata
    if (!meta || !this._binary) return null
    return {
      ...meta,
      segments: this._binary,
      eventData: {
        ...meta.eventData,
        events: this.getEventBuffersJson(),
      },
    }
  }

  /**
   * Merge `memberIds` into `representativeId` on one axis (see PLANMERGE.md
   * M3/M4). A disjoint, reversible, wholesale rebuild off the render loop:
   * reconstruct the dataset, fold via the pure per-axis merge, and reload — so
   * the segment/AOI hot paths and every consumer see an ordinary dataset. The
   * stimulus fold additionally reconciles the per-stimulus AOI + event-channel
   * dictionaries. The append-only merge log records the exact inverse. Throws
   * (before any state change) if the merge is not disjoint.
   */
  mergeEntities(
    axis: 'participant' | 'stimulus',
    representativeId: number,
    memberIds: number[],
    at: number
  ) {
    const data = this.toDataType()
    if (!data) return
    const fold =
      axis === 'participant' ? applyParticipantMerge : applyStimulusMerge
    this.loadDataset(fold(data, representativeId, memberIds, at))
  }

  /** Exact inverse of {@link mergeEntities}; the log entry carries its axis. */
  unmergeEntities(entry: MergeLogEntry) {
    const data = this.toDataType()
    if (!data) return
    const unfold =
      entry.axis === 'participant' ? applyParticipantUnmerge : applyStimulusUnmerge
    this.loadDataset(unfold(data, entry))
  }

  get segments() {
    return this._binary
  }
}
