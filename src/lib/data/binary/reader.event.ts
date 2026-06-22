import {
  type BinaryEventBuffers,
  EVENT_STRIDE,
} from './schema'

const EMPTY_OCCURRENCES = new Float32Array(0)

/**
 * Convert the legacy `number[][][][]` event layout
 * (`[stimulus][channel][participant] → stride-2 [start, duration, ...]`)
 * into contiguous binary buffers. This is to events what
 * `jsonSegmentsToBinary` is to segments: the in-memory representation is
 * binary, the serialized/wire shape stays `number[][][][]`.
 */
export function jsonEventsToBinary(
  events: number[][][][]
): BinaryEventBuffers {
  const stimuliCount = events.length
  const channelOffsets = new Uint32Array(stimuliCount + 1)

  let totalChannels = 0
  let maxParticipants = 0
  let totalElements = 0
  for (let s = 0; s < stimuliCount; s++) {
    const channels = events[s] ?? []
    channelOffsets[s] = totalChannels
    totalChannels += channels.length
    for (let c = 0; c < channels.length; c++) {
      const participants = channels[c] ?? []
      if (participants.length > maxParticipants) {
        maxParticipants = participants.length
      }
      for (let p = 0; p < participants.length; p++) {
        totalElements += participants[p]?.length ?? 0
      }
    }
  }
  channelOffsets[stimuliCount] = totalChannels

  const occurrenceBuffer = new Float32Array(totalElements)
  const indexTable = new Uint32Array(totalChannels * maxParticipants * 2)

  let cursor = 0
  for (let s = 0; s < stimuliCount; s++) {
    const channels = events[s] ?? []
    const channelBase = channelOffsets[s]
    for (let c = 0; c < channels.length; c++) {
      const participants = channels[c] ?? []
      const globalChannel = channelBase + c
      for (let p = 0; p < participants.length; p++) {
        const buffer = participants[p] ?? []
        const idx = (globalChannel * maxParticipants + p) * 2
        indexTable[idx] = cursor
        for (let i = 0; i < buffer.length; i++) {
          occurrenceBuffer[cursor++] = buffer[i]
        }
        indexTable[idx + 1] = cursor
      }
    }
  }

  return {
    occurrenceBuffer,
    channelOffsets,
    indexTable,
    maxParticipants,
    stimuliCount,
  }
}

/**
 * Zero-allocation reader over binary event occurrences — the event
 * counterpart of {@link BinaryBufferReader}. Owned by the data engine
 * OUTSIDE Svelte runes, so hot loops (scarf event overlay) read raw numbers
 * without per-element proxy `get` traps. Rebuilt wholesale on event
 * mutation, exactly as `AoiGroupReader` rebuilds its group pool — events
 * change only on import, interval derivation, and channel deletion, never
 * inside a render loop.
 */
export class EventBufferReader {
  private occurrenceBuffer: Float32Array = EMPTY_OCCURRENCES
  private channelOffsets: Uint32Array = new Uint32Array(1)
  private indexTable: Uint32Array = new Uint32Array(0)
  private maxParticipants = 0
  private stimuliCount = 0

  constructor(buffers?: BinaryEventBuffers) {
    if (buffers) this.adopt(buffers)
  }

  /** Rebuild the binary form from the legacy `number[][][][]` layout. */
  load(events: number[][][][]): void {
    this.adopt(jsonEventsToBinary(events))
  }

  private adopt(buffers: BinaryEventBuffers): void {
    this.occurrenceBuffer = buffers.occurrenceBuffer
    this.channelOffsets = buffers.channelOffsets
    this.indexTable = buffers.indexTable
    this.maxParticipants = buffers.maxParticipants
    this.stimuliCount = buffers.stimuliCount
  }

  /** Number of channels stored for a stimulus. */
  getChannelCount(stimulusId: number): number {
    if (stimulusId < 0 || stimulusId >= this.stimuliCount) return 0
    return (
      this.channelOffsets[stimulusId + 1] - this.channelOffsets[stimulusId]
    )
  }

  /**
   * Direct subarray view of one cell's stride-2 occurrences
   * `[start, duration, ...]`. Zero allocations — a window into the shared
   * buffer. Returns an empty view when the cell has no occurrences or the
   * indices are out of range.
   */
  getOccurrences(
    stimulusId: number,
    channelId: number,
    participantId: number
  ): Float32Array {
    if (stimulusId < 0 || stimulusId >= this.stimuliCount) {
      return EMPTY_OCCURRENCES
    }
    if (participantId < 0 || participantId >= this.maxParticipants) {
      return EMPTY_OCCURRENCES
    }
    const channelBase = this.channelOffsets[stimulusId]
    const channelEnd = this.channelOffsets[stimulusId + 1]
    const globalChannel = channelBase + channelId
    if (channelId < 0 || globalChannel >= channelEnd) return EMPTY_OCCURRENCES

    const idx = (globalChannel * this.maxParticipants + participantId) * 2
    const start = this.indexTable[idx]
    const end = this.indexTable[idx + 1]
    if (end <= start) return EMPTY_OCCURRENCES
    return this.occurrenceBuffer.subarray(start, end)
  }

  /** Total occurrences for one (stimulus, channel) across all participants. */
  getChannelOccurrenceCount(stimulusId: number, channelId: number): number {
    let total = 0
    for (let p = 0; p < this.maxParticipants; p++) {
      total += this.getOccurrences(stimulusId, channelId, p).length / EVENT_STRIDE
    }
    return total
  }

  /** Earliest occurrence start for one (stimulus, channel), or Infinity. */
  getChannelFirstOnset(stimulusId: number, channelId: number): number {
    let onset = Infinity
    for (let p = 0; p < this.maxParticipants; p++) {
      const buf = this.getOccurrences(stimulusId, channelId, p)
      for (let i = 0; i < buf.length; i += EVENT_STRIDE) {
        if (buf[i] < onset) onset = buf[i]
      }
    }
    return onset
  }

  /** True if a stimulus has any occurrence in any channel/participant. */
  hasEventsForStimulus(stimulusId: number): boolean {
    const count = this.getChannelCount(stimulusId)
    for (let c = 0; c < count; c++) {
      for (let p = 0; p < this.maxParticipants; p++) {
        if (this.getOccurrences(stimulusId, c, p).length > 0) return true
      }
    }
    return false
  }

  /** Per-stimulus event-presence flags (drives `eventsPerStimulus`). */
  presencePerStimulus(): boolean[] {
    const out = new Array<boolean>(this.stimuliCount)
    for (let s = 0; s < this.stimuliCount; s++) {
      out[s] = this.hasEventsForStimulus(s)
    }
    return out
  }

  /** True if any stimulus has any occurrence (drives `capabilities.event`). */
  hasAnyEvents(): boolean {
    for (let s = 0; s < this.stimuliCount; s++) {
      if (this.hasEventsForStimulus(s)) return true
    }
    return false
  }

  /**
   * Reconstruct one stimulus's `number[][][]` (channel × participant ×
   * stride-2 buffer). Cold-path helper for command inverses, interval
   * derivation, and channel-removal payloads that still operate on the
   * legacy nested shape.
   */
  getStimulusJson(stimulusId: number): number[][][] {
    const channelCount = this.getChannelCount(stimulusId)
    const out: number[][][] = new Array(channelCount)
    for (let c = 0; c < channelCount; c++) {
      const channel: number[][] = new Array(this.maxParticipants)
      for (let p = 0; p < this.maxParticipants; p++) {
        channel[p] = Array.from(this.getOccurrences(stimulusId, c, p))
      }
      out[c] = channel
    }
    return out
  }

  /** Reconstruct the full `number[][][][]` (export / serialization). */
  toJson(): number[][][][] {
    const out: number[][][][] = new Array(this.stimuliCount)
    for (let s = 0; s < this.stimuliCount; s++) {
      out[s] = this.getStimulusJson(s)
    }
    return out
  }
}
