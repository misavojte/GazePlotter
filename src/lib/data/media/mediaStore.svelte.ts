import type { StimulusMedia } from '../types'

/**
 * Non-reactive byte store for per-stimulus reference media (see
 * {@link StimulusMedia}). The engine's `metadata.stimuliMedia` holds the
 * light metadata inside runes; the Blobs stay out here — the same split as
 * the binary segment buffers — because a 50-minute recording can be GBs and
 * must never be copied into reactive state or base64.
 *
 * Rendering goes through {@link getReadyElement}: a lazily created
 * `<img>`/`<video>` fed by an object URL (browsers stream `<video>` from blob
 * URLs without decoding the file into JS memory). `version` is the reactive
 * repaint signal — it bumps when an element finishes decoding and on every
 * set/remove/clear, so canvases that draw media depend on it.
 */
class StimulusMediaStore {
  /** Bumps on decode-ready and on set/remove/clear — the canvas repaint dep. */
  version = $state(0)

  private blobs = new Map<number, Blob>()
  private elements = new Map<
    number,
    {
      url: string
      el: HTMLImageElement | HTMLVideoElement
      ready: boolean
    }
  >()

  setBlob(stimulusId: number, blob: Blob): void {
    this.evictElement(stimulusId)
    this.blobs.set(stimulusId, blob)
    this.version++
  }

  getBlob(stimulusId: number): Blob | null {
    return this.blobs.get(stimulusId) ?? null
  }

  remove(stimulusId: number): void {
    this.evictElement(stimulusId)
    this.blobs.delete(stimulusId)
    this.version++
  }

  clear(): void {
    for (const id of [...this.elements.keys()]) this.evictElement(id)
    this.blobs.clear()
    this.version++
  }

  /**
   * The drawable element for a stimulus, or null while it is still decoding
   * (the `version` bump on ready triggers the re-read). Videos are parked on
   * their first frame — a paused poster, not a player.
   */
  getReadyElement(
    stimulusId: number,
    media: StimulusMedia
  ): HTMLImageElement | HTMLVideoElement | null {
    const cached = this.elements.get(stimulusId)
    if (cached) return cached.ready ? cached.el : null

    const blob = this.blobs.get(stimulusId)
    if (!blob || typeof document === 'undefined') return null

    const url = URL.createObjectURL(blob)
    if (media.kind === 'image') {
      const el = new Image()
      const entry = { url, el, ready: false }
      this.elements.set(stimulusId, entry)
      el.onload = () => {
        entry.ready = true
        this.version++
      }
      el.src = url
    } else {
      const el = document.createElement('video')
      el.muted = true
      el.preload = 'auto'
      const entry = { url, el, ready: false }
      this.elements.set(stimulusId, entry)
      el.addEventListener(
        'seeked',
        () => {
          entry.ready = true
          this.version++
        },
        { once: true }
      )
      el.addEventListener(
        'loadeddata',
        () => {
          // Seek off 0 by an epsilon — some browsers only paint a drawable
          // frame after an actual seek.
          el.currentTime = 0.001
        },
        { once: true }
      )
      el.src = url
    }
    return null
  }

  private evictElement(stimulusId: number): void {
    const entry = this.elements.get(stimulusId)
    if (!entry) return
    entry.el.src = ''
    URL.revokeObjectURL(entry.url)
    this.elements.delete(stimulusId)
  }
}

export const stimulusMediaStore = new StimulusMediaStore()

/** Media file extension for zip entry names — from the upload name, falling
 *  back to the mime subtype. */
export function mediaFileExtension(media: StimulusMedia): string {
  const dot = media.fileName.lastIndexOf('.')
  if (dot > 0 && dot < media.fileName.length - 1) {
    return media.fileName.slice(dot + 1).toLowerCase()
  }
  return media.mimeType.split('/')[1] ?? 'bin'
}
