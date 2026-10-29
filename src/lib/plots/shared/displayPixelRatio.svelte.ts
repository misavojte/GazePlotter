import { sessionScoped } from '$lib/session/context'

/**
 * The display's device pixel ratio as one reactive value shared by every plot
 * in a session. One `(resolution: Ndppx)` query is re-armed at each new ratio,
 * so any change fires (a window moved to another display, browser zoom), not
 * only a crossing of exactly 1x.
 */
class DisplayPixelRatio {
  current = $state(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') this.#watch()
  }

  #watch() {
    window
      .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener(
        'change',
        () => {
          this.current = window.devicePixelRatio || 1
          this.#watch()
        },
        { once: true }
      )
  }
}

export const useDisplayPixelRatio = sessionScoped(() => new DisplayPixelRatio())
