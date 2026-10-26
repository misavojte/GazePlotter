import type { StimulusMedia } from '../types'

/**
 * Non-reactive byte store for per-stimulus reference media (see
 * {@link StimulusMedia}). The engine's `metadata.stimuliMedia` holds the
 * light metadata inside runes; the Blobs stay out here, the same split as
 * the binary segment buffers, because a 50-minute recording can be GBs and
 * must never be copied into reactive state or base64.
 *
 * Decoding bytes into drawable elements is the plots' concern
 * (`plots/shared/mediaElements`), keyed off {@link stamp}: a new stamp
 * means new bytes to decode.
 */
export class StimulusMediaStore {
  /** Bumps on every set, remove, and clear: the canvas repaint dep. */
  version = $state(0)

  private blobs = new Map<number, Blob>()
  private stamps = new Map<number, number>()
  private counter = 0

  setBlob(stimulusId: number, blob: Blob): void {
    // Same bytes (an alignment edit or its undo): nothing to re-decode.
    if (this.blobs.get(stimulusId) === blob) return
    this.blobs.set(stimulusId, blob)
    this.stamps.set(stimulusId, ++this.counter)
    this.version++
  }

  /** Same bytes from a new source (the file a save just wrote). A decoded
   *  image keeps its pixels; a video streams from its source, so it reloads. */
  rebindBlob(stimulusId: number, blob: Blob, kind: StimulusMedia['kind']): void {
    if (!this.blobs.has(stimulusId)) return
    this.blobs.set(stimulusId, blob)
    if (kind === 'video') {
      this.stamps.set(stimulusId, ++this.counter)
      this.version++
    }
  }

  getBlob(stimulusId: number): Blob | null {
    return this.blobs.get(stimulusId) ?? null
  }

  /** Changes whenever the stimulus has new bytes to decode; 0 = none stored. */
  stamp(stimulusId: number): number {
    return this.stamps.get(stimulusId) ?? 0
  }

  remove(stimulusId: number): void {
    this.blobs.delete(stimulusId)
    this.stamps.delete(stimulusId)
    this.version++
  }

  clear(): void {
    this.blobs.clear()
    this.stamps.clear()
    this.version++
  }
}
