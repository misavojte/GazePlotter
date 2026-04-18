<script lang="ts">
  import { fade } from 'svelte/transition'
  import { getGazePlotterSession } from '$lib/session'
  import { gridToPixelDimensions, gridToPixelPosition } from './grid/pixels'
  import type { GridConfig } from './grid/types'

  interface Props {
    workspaceContainer: HTMLElement | null
    zoom: number
    gridConfig: GridConfig
    // Element occluding the viewport bottom (mobile rail); null when none.
    bottomOcclusionElement?: HTMLElement | null
  }

  const {
    workspaceContainer,
    zoom,
    gridConfig,
    bottomOcclusionElement = null,
  }: Props = $props()
  const { grid } = getGazePlotterSession()

  const PADDING = 35
  const MARGIN = 20

  let scrollLeft = $state(0)
  let scrollTop = $state(0)
  let viewportW = $state(0)
  let viewportH = $state(0)
  let rectLeft = $state(0)
  let rectTop = $state(0)
  let windowW = $state(0)
  let windowH = $state(0)

  $effect(() => {
    const el = workspaceContainer
    if (!el) return

    const syncScroll = () => {
      scrollLeft = el.scrollLeft
      scrollTop = el.scrollTop
    }
    const syncRect = () => {
      const r = el.getBoundingClientRect()
      rectLeft = r.left
      rectTop = r.top
      windowW = window.innerWidth
      windowH = window.innerHeight
    }
    const syncSize = () => {
      viewportW = el.clientWidth
      viewportH = el.clientHeight
      syncRect()
    }
    syncScroll()
    syncSize()

    el.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('scroll', syncRect, { passive: true })
    window.addEventListener('resize', syncRect)
    const ro = new ResizeObserver(syncSize)
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', syncScroll)
      window.removeEventListener('scroll', syncRect)
      window.removeEventListener('resize', syncRect)
      ro.disconnect()
    }
  })

  const indicator = $derived.by(() => {
    const item = grid.selectedItem
    if (!item || !workspaceContainer || viewportW === 0 || viewportH === 0) {
      return null
    }

    // Item bounds in container-content space (post-scale, post-padding).
    const pos = gridToPixelPosition(item.x, item.y, gridConfig)
    const size = gridToPixelDimensions(item.w, item.h, gridConfig)
    const contentLeft = PADDING + pos.left * zoom
    const contentTop = PADDING + pos.top * zoom
    const contentW = size.width * zoom
    const contentH = size.height * zoom
    const contentCx = contentLeft + contentW / 2
    const contentCy = contentTop + contentH / 2

    // Page-space positions (relative to the browser viewport origin).
    // The container's padding-box aligns with rectLeft/rectTop, so a
    // content-space point (cx, cy) lands at (rectLeft + cx - scrollLeft,
    // rectTop + cy - scrollTop) on screen.
    const itemPageLeft = rectLeft + contentLeft - scrollLeft
    const itemPageTop = rectTop + contentTop - scrollTop
    const itemPageRight = itemPageLeft + contentW
    const itemPageBottom = itemPageTop + contentH
    const itemPageCx = rectLeft + contentCx - scrollLeft
    const itemPageCy = rectTop + contentCy - scrollTop

    // Effective visible region in page coords: intersection of the
    // container's on-screen rect with the browser window.
    const bottomInset =
      bottomOcclusionElement?.getBoundingClientRect().height ?? 0
    const pageLeft = Math.max(0, rectLeft)
    const pageTop = Math.max(0, rectTop)
    const pageRight = Math.min(windowW, rectLeft + viewportW)
    const pageBottom = Math.min(windowH - bottomInset, rectTop + viewportH)
    const pageW = pageRight - pageLeft
    const pageH = pageBottom - pageTop
    if (pageW <= 0 || pageH <= 0) return null

    const visible =
      itemPageRight > pageLeft &&
      itemPageLeft < pageRight &&
      itemPageBottom > pageTop &&
      itemPageTop < pageBottom
    if (visible) return null

    // Cast a ray from the visible-region center toward the item center,
    // then clip it to the region's inset rectangle so the arrow sits
    // MARGIN px inside whichever edge the item lies past.
    const vpCx = (pageLeft + pageRight) / 2
    const vpCy = (pageTop + pageBottom) / 2
    const dx = itemPageCx - vpCx
    const dy = itemPageCy - vpCy
    const halfW = Math.max(0, pageW / 2 - MARGIN)
    const halfH = Math.max(0, pageH / 2 - MARGIN)
    const t = Math.min(
      halfW / Math.max(1, Math.abs(dx)),
      halfH / Math.max(1, Math.abs(dy))
    )

    return {
      pageX: vpCx + dx * t,
      pageY: vpCy + dy * t,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      contentCx,
      contentCy,
    }
  })

  function scrollToSelection(e: MouseEvent) {
    e.stopPropagation()
    const ind = indicator
    if (!ind || !workspaceContainer) return
    const el = workspaceContainer

    // 1. Center the item in the container's own scroll viewport,
    //    clamped to its scroll extents so we actually land on-target
    //    instead of against a clamped bound silently.
    const maxScrollLeft = Math.max(0, el.scrollWidth - viewportW)
    const maxScrollTop = Math.max(0, el.scrollHeight - viewportH)
    const targetScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, ind.contentCx - viewportW / 2)
    )
    const targetScrollTop = Math.max(
      0,
      Math.min(maxScrollTop, ind.contentCy - viewportH / 2)
    )
    el.scrollTo({
      left: targetScrollLeft,
      top: targetScrollTop,
      behavior: 'smooth',
    })

    // 2. After the container scroll settles, the item will sit at this
    //    on-page position. If that's outside (or near the edge of) the
    //    browser viewport, scroll the page too so the item is actually
    //    looking back at the user. Using `scrollIntoView` with
    //    block:'nearest' doesn't suffice here — when the container is
    //    taller than the window it counts as "already visible", so the
    //    page doesn't adjust and the item ends up centered only within
    //    the container (off-screen).
    const finalPageX = rectLeft + ind.contentCx - targetScrollLeft
    const finalPageY = rectTop + ind.contentCy - targetScrollTop
    const edgeMargin = 80
    let nextWinX = window.scrollX
    let nextWinY = window.scrollY
    if (finalPageX < edgeMargin || finalPageX > windowW - edgeMargin) {
      nextWinX = window.scrollX + finalPageX - windowW / 2
    }
    if (finalPageY < edgeMargin || finalPageY > windowH - edgeMargin) {
      nextWinY = window.scrollY + finalPageY - windowH / 2
    }
    if (nextWinX !== window.scrollX || nextWinY !== window.scrollY) {
      window.scrollTo({
        left: Math.max(0, nextWinX),
        top: Math.max(0, nextWinY),
        behavior: 'smooth',
      })
    }
  }
</script>

{#if indicator}
  <button
    type="button"
    class="indicator"
    style="left: {indicator.pageX}px; top: {indicator.pageY}px; transform: translate(-50%, -50%) rotate({indicator.angle}deg);"
    onclick={scrollToSelection}
    aria-label="Scroll to selected item"
    transition:fade={{ duration: 120 }}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1 L14 14 L8 11 L2 14 Z" />
    </svg>
  </button>
{/if}

<style>
  .indicator {
    position: fixed;
    width: 48px;
    height: 48px;
    border: 0;
    padding: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--c-info);
    filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18));
    z-index: 50;
  }

  .indicator svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
    stroke: #ffffff;
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .indicator:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 2px;
    border-radius: 50%;
  }

  @media (max-width: 1024px) {
    .indicator {
      width: 40px;
      height: 40px;
    }
    .indicator svg {
      width: 22px;
      height: 22px;
    }
  }

  @media (max-width: 768px) {
    .indicator {
      width: 32px;
      height: 32px;
    }
    .indicator svg {
      width: 16px;
      height: 16px;
    }
  }
</style>
