// Height of the host page's scroll banner, shared by every workspace surface
// that sticks below it (the rail, the pane). One `scroll` listener and one DOM
// read for one global fact — same shape as `responsive.svelte.ts`, which owns
// the viewport breakpoint the same way.
//
// The banner belongs to the host page, not the workspace (the survey renders
// `.scroll-banner`), so this is the ONE place that reaches across that boundary.
// It reads 0 when there is no banner, which is the correct offset for a host
// page that has none.

const BANNER_SELECTOR = '.scroll-banner'

function createStickyBanner() {
  let height = $state(0)

  // Exported so a surface can measure synchronously on mount: the rail
  // re-mounts after a pane selection hid it, and an enter animation that starts
  // from a stale 0 visibly snaps into place on the next scroll event.
  const measure = () => {
    if (typeof document === 'undefined') return
    const banner = document.querySelector(BANNER_SELECTOR)
    height = banner instanceof HTMLElement ? banner.offsetHeight : 0
  }

  // Resize too: a narrower viewport can rewrap the banner text and change its
  // height without any scroll happening.
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
  }

  return {
    get height() {
      return height
    },
    measure,
  }
}

export const stickyBanner = createStickyBanner()
