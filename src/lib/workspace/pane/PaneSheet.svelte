<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { cubicInOut } from 'svelte/easing'
  import type { Snippet } from 'svelte'
  import PaneHeader from './PaneHeader.svelte'
  import { PANE_TRANSITION } from './transition'

  interface Props {
    title: string
    onClose: () => void
    children: Snippet
  }

  const { title, onClose, children }: Props = $props()

  const FLY_DISTANCE = 800

  /** A pull this far down closes the sheet on release. */
  const DISMISS_PX = 96
  /** Or a flick: this fast (px per ms), however short the pull. */
  const DISMISS_VELOCITY = 0.5
  /** How long the released sheet takes to settle back or finish leaving. */
  const SETTLE_MS = 200

  // How far the finger has pulled the sheet down. Dragging is the grab
  // strip's own gesture, so the body underneath keeps scrolling.
  let pull = $state(0)
  let dragging = $state(false)
  // The pull carried the sheet out: it has already left under its own
  // settle, so the unmount must not fly it a second time.
  let dismissed = $state(false)
  let height = $state(0)
  let origin: { y: number; at: number } | null = null

  function grab(event: TouchEvent) {
    if (event.touches.length !== 1 || dismissed) return
    origin = { y: event.touches[0].clientY, at: event.timeStamp }
    dragging = true
  }

  // No preventDefault: Svelte binds touchmove passively, and the strip's
  // `touch-action: none` is what keeps the gesture off the page.
  function drag(event: TouchEvent) {
    if (!origin) return
    pull = Math.max(0, event.touches[0].clientY - origin.y)
  }

  function release(event: TouchEvent) {
    if (!origin) return
    const elapsed = Math.max(1, event.timeStamp - origin.at)
    const flicked = pull / elapsed > DISMISS_VELOCITY
    origin = null
    dragging = false
    if (pull > DISMISS_PX || (flicked && pull > 16)) {
      dismissed = true
      pull = height || FLY_DISTANCE
      setTimeout(onClose, SETTLE_MS)
      return
    }
    pull = 0
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sheet-backdrop"
  class:settling={!dragging}
  style="opacity: {height ? Math.max(0, 1 - pull / height) : 1};"
  onclick={onClose}
  transition:fade={{ duration: 200, easing: cubicInOut }}
></div>

<aside
  class="sheet"
  class:settling={!dragging}
  aria-label={`${title} settings`}
  style="transform: translateY({pull}px);"
  bind:clientHeight={height}
  in:fly={{
    y: FLY_DISTANCE,
    duration: PANE_TRANSITION.duration,
    easing: cubicInOut,
  }}
  out:fly={{
    y: FLY_DISTANCE,
    duration: dismissed ? 0 : PANE_TRANSITION.duration,
    easing: cubicInOut,
  }}
>
  <!-- The grab strip: handle and title. Swiping it down closes the sheet,
       the way every phone sheet closes. A touch gesture with no pointer or
       keyboard equivalent to declare: the backdrop and Escape close it. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grab"
    ontouchstart={grab}
    ontouchmove={drag}
    ontouchend={release}
    ontouchcancel={release}
  >
    <div class="handle" aria-hidden="true"></div>
    <PaneHeader {title} />
  </div>
  <div class="body">
    {@render children()}
  </div>
</aside>

<style>
  /* Dim the area above the sheet. Derived from --c-black at
     ~28% opacity — matches the muted, chrome-free visual language by
     avoiding pure black. */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--c-black) 28%, transparent);
    z-index: 9;
  }

  /* Bottom-anchored sheet. Takes the full viewport width, caps height at
     80vh, and keeps a workable minimum so quick-actions/title aren't
     crammed on short screens. Borders only on top (left/right meet the
     viewport edges); top corners rounded with the workspace's large
     radius token to match other surfaces' soft-corner language. */
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    background-color: var(--c-white);
    border-top: 1px solid var(--c-border);
    border-top-left-radius: var(--rounded-lg);
    border-top-right-radius: var(--rounded-lg);
    max-height: 50vh;
    min-height: 40vh;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* Only once the finger is off: under it the sheet and the dimming track
     the touch. Matches SETTLE_MS. */
  .settling {
    transition:
      transform var(--transition-normal) ease-out,
      opacity var(--transition-normal) ease-out;
  }

  /* The sheet follows the finger from here, so the touch is ours and not
     the page's. */
  .grab {
    flex-shrink: 0;
    touch-action: none;
  }

  /* Drag-affordance pill. 32x4 centered near the top edge, and the thing
     you pull the sheet down by. Uses --c-midgrey so it reads as a subtle
     indicator, not a button. */
  .handle {
    width: 32px;
    height: 4px;
    border-radius: var(--rounded);
    background: var(--c-midgrey);
    margin: 8px auto 0;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* Form-control compactness is opt-in per control via the `compact` prop,
     passed explicitly by the pane sections. No `:global()` overrides here. */
</style>
