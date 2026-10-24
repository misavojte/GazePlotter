import type { StimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
import type { StimulusMedia } from '$lib/data/types'
import { sessionScoped } from '$lib/session/context'

/**
 * Drawable elements for the engine's media bytes: a lazily created
 * `<img>`/`<video>` per stimulus, fed by an object URL (browsers stream
 * `<video>` from blob URLs without decoding the file into JS memory). An
 * element is re-decoded when the store's {@link StimulusMediaStore.stamp}
 * for its stimulus changes. `version` is the repaint signal: it bumps when
 * the store changes and when an element finishes decoding or fails.
 */
export class MediaElementCache {
  private readonly store: StimulusMediaStore
  private ticks = $state(0)
  /** Repaint signal: the store's bytes changed, or a decode finished or failed. */
  get version(): number {
    return this.store.version + this.ticks
  }

  private elements = new Map<
    number,
    {
      stamp: number
      url: string
      el: HTMLImageElement | HTMLVideoElement
      ready: boolean
      failed: boolean
    }
  >()

  constructor(store: StimulusMediaStore) {
    this.store = store
  }

  /** True once the browser has refused to decode a stimulus's media (e.g. an
   *  unsupported video codec); read alongside `version`. */
  failed(stimulusId: number): boolean {
    const entry = this.elements.get(stimulusId)
    return !!entry && entry.stamp === this.store.stamp(stimulusId) && entry.failed
  }

  /**
   * The drawable element for a stimulus, or null while it is still decoding
   * (the `version` bump on ready triggers the re-read). Videos are parked on
   * their first frame: a paused poster, not a player.
   */
  getReadyElement(
    stimulusId: number,
    media: StimulusMedia
  ): HTMLImageElement | HTMLVideoElement | null {
    // Every store change repaints every media-drawing figure through here,
    // so this sweep is where bytes the store released get their elements
    // and object URLs released too (recordings can be GBs).
    for (const [id, entry] of this.elements) {
      if (entry.stamp !== this.store.stamp(id)) this.evict(id)
    }
    const stamp = this.store.stamp(stimulusId)
    const cached = this.elements.get(stimulusId)
    if (cached) return cached.ready ? cached.el : null

    const blob = this.store.getBlob(stimulusId)
    if (!blob || typeof document === 'undefined') return null

    const url = URL.createObjectURL(blob)
    const el =
      media.kind === 'image' ? new Image() : document.createElement('video')
    const entry = { stamp, url, el, ready: false, failed: false }
    this.elements.set(stimulusId, entry)
    const markReady = () => {
      if (entry.ready) return
      entry.ready = true
      this.ticks++
    }
    const markFailed = () => {
      if (this.elements.get(stimulusId) !== entry) return // evicted: src cleared
      entry.failed = true
      this.ticks++
    }
    el.addEventListener('error', markFailed, { once: true })
    if (el instanceof HTMLImageElement) {
      el.addEventListener('load', markReady, { once: true })
    } else {
      el.muted = true
      el.playsInline = true
      el.preload = 'auto'
      // The readiness gate is what prevents a black background: the element
      // is only handed out once a frame is decoded. 'seeked' after an
      // explicit off-zero seek guarantees a paintable frame everywhere;
      // 'canplaythrough' is the fallback for browsers that decode the first
      // frame without honoring the tiny seek.
      el.addEventListener('seeked', markReady, { once: true })
      el.addEventListener('canplaythrough', markReady, { once: true })
      el.addEventListener(
        'loadedmetadata',
        () => {
          // Seek off 0 by an epsilon: some browsers only paint a drawable
          // frame after an actual seek.
          el.currentTime = 0.001
        },
        { once: true }
      )
    }
    el.src = url
    return null
  }

  /** Releases every element and object URL (recordings can be GBs). */
  clear(): void {
    for (const id of [...this.elements.keys()]) this.evict(id)
  }

  private evict(stimulusId: number): void {
    const entry = this.elements.get(stimulusId)
    if (!entry) return
    entry.el.src = ''
    URL.revokeObjectURL(entry.url)
    this.elements.delete(stimulusId)
  }
}

/** One cache per session, over that session's engine media store. */
export const useMediaElements = sessionScoped(
  session => new MediaElementCache(session.engine.media)
)
