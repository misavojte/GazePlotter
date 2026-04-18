// Reactive viewport-size flag shared across the workspace. Drives the
// mobile two-step pane flow (tap-to-select vs explicit Edit-to-open).
// Backed by a single `matchMedia` listener; the $state mutation fans
// out via Svelte 5 reactivity so components re-render on breakpoint
// crossing without each one installing its own listener.

export const MOBILE_BREAKPOINT_PX = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`

function createResponsive() {
  // SSR / non-browser guard: default to desktop so server-rendered HTML
  // matches the desktop layout; hydration on the client flips the flag
  // before any interaction if the viewport is actually small.
  const initial =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false

  let isMobile = $state(initial)

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mql = window.matchMedia(QUERY)
    mql.addEventListener('change', e => {
      isMobile = e.matches
    })
  }

  return {
    get isMobile() {
      return isMobile
    },
  }
}

export const responsive = createResponsive()
