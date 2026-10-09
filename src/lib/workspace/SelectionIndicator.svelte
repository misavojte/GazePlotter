<script lang="ts">
  import { fade } from 'svelte/transition'
  import { getGazePlotterSession } from '$lib/session'
  import { gridToPixelDimensions, gridToPixelPosition } from './grid/pixels'
  import type { GridConfig } from './grid/types'
  import type { WorkspaceCamera } from './camera.svelte'

  interface Props {
    // The workspace frame the camera looks through.
    frame: HTMLElement | null
    camera: WorkspaceCamera
    gridConfig: GridConfig
  }

  const {
    frame,
    camera,
    gridConfig,
  }: Props = $props()
  const { grid } = getGazePlotterSession()

  const MARGIN = 20

  // The frame's padding box on screen, and the window, kept current on page
  // scroll and resize. The camera itself is reactive.
  let frameLeft = $state(0)
  let frameTop = $state(0)
  let frameW = $state(0)
  let frameH = $state(0)
  let windowW = $state(0)
  let windowH = $state(0)

  $effect(() => {
    const el = frame
    if (!el) return

    const sync = () => {
      const r = el.getBoundingClientRect()
      frameLeft = r.left + el.clientLeft
      frameTop = r.top + el.clientTop
      frameW = el.clientWidth
      frameH = el.clientHeight
      windowW = window.innerWidth
      windowH = window.innerHeight
    }
    sync()

    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    const ro = new ResizeObserver(sync)
    ro.observe(el)

    return () => {
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      ro.disconnect()
    }
  })

  const indicator = $derived.by(() => {
    const item = grid.selectedItem
    if (!item || !frame || frameW === 0 || frameH === 0) return null

    // Item bounds on screen: frame origin + camera offset + scaled grid px.
    const zoom = camera.zoom
    const pos = gridToPixelPosition(item.x, item.y, gridConfig)
    const size = gridToPixelDimensions(item.w, item.h, gridConfig)
    const itemLeft = frameLeft + camera.x + pos.left * zoom
    const itemTop = frameTop + camera.y + pos.top * zoom
    const itemRight = itemLeft + size.width * zoom
    const itemBottom = itemTop + size.height * zoom
    const itemCx = (itemLeft + itemRight) / 2
    const itemCy = (itemTop + itemBottom) / 2

    // Visible region: the frame clipped to the window.
    const pageLeft = Math.max(0, frameLeft)
    const pageTop = Math.max(0, frameTop)
    const pageRight = Math.min(windowW, frameLeft + frameW)
    const pageBottom = Math.min(windowH, frameTop + frameH)
    const pageW = pageRight - pageLeft
    const pageH = pageBottom - pageTop
    if (pageW <= 0 || pageH <= 0) return null

    const visible =
      itemRight > pageLeft &&
      itemLeft < pageRight &&
      itemBottom > pageTop &&
      itemTop < pageBottom
    if (visible) return null

    // Cast a ray from the visible-region center toward the item center,
    // then clip it to the region's inset rectangle so the arrow sits
    // MARGIN px inside whichever edge the item lies past.
    const vpCx = (pageLeft + pageRight) / 2
    const vpCy = (pageTop + pageBottom) / 2
    const dx = itemCx - vpCx
    const dy = itemCy - vpCy
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
      rect: {
        left: pos.left,
        top: pos.top,
        right: pos.left + size.width,
        bottom: pos.top + size.height,
      },
    }
  })

  function revealSelection(e: MouseEvent) {
    e.stopPropagation()
    const ind = indicator
    if (!ind || !frame) return
    camera.reveal(ind.rect)
    // The frame itself may be partly off the page: bring it into view too.
    if (frameTop < 0 || frameTop + frameH > windowH) {
      frame.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }
</script>

{#if indicator}
  <button
    type="button"
    class="indicator"
    style="left: {indicator.pageX}px; top: {indicator.pageY}px; transform: translate(-50%, -50%) rotate({indicator.angle}deg);"
    onclick={revealSelection}
    aria-label="Show selected plot"
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
    filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--c-black) 18%, transparent));
    z-index: 50;
  }

  .indicator svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
    stroke: var(--c-white);
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
