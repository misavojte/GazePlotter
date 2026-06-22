<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { cubicInOut } from 'svelte/easing'
  import type { Snippet } from 'svelte'
  import PaneHeader from './PaneHeader.svelte'
  import { PANE_TRANSITION } from './transition'
  import { markInPane } from '$lib/shared/components/paneContext'

  markInPane()

  interface Props {
    title: string
    onClose: () => void
    children: Snippet
  }

  const { title, onClose, children }: Props = $props()

  // Sheet enters after the FAB has finished its 180ms exit animation.
  // Sheet exits at t=0 (closing the sheet is the first motion; the
  // returning FAB waits for the sheet to clear via its own intro delay).
  const SHEET_ENTER_DELAY = 180
  const FLY_DISTANCE = 800
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sheet-backdrop"
  onclick={onClose}
  transition:fade={{ duration: 200, easing: cubicInOut }}
></div>

<aside
  class="sheet"
  aria-label={`${title} settings`}
  in:fly={{
    y: FLY_DISTANCE,
    duration: PANE_TRANSITION.duration,
    delay: SHEET_ENTER_DELAY,
    easing: cubicInOut,
  }}
  out:fly={{
    y: FLY_DISTANCE,
    duration: PANE_TRANSITION.duration,
    easing: cubicInOut,
  }}
>
  <div class="handle" aria-hidden="true"></div>
  <PaneHeader {title} {onClose} />
  <div class="body">
    {@render children()}
  </div>
</aside>

<style>
  /* Dim the area above the sheet. Derived from --c-black (#0f172a) at
     ~28% opacity — matches the muted, chrome-free visual language by
     avoiding pure black. */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.28);
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
    background-color: var(--c-lightgrey);
    border-top: 1px solid var(--c-border);
    border-top-left-radius: var(--rounded-lg);
    border-top-right-radius: var(--rounded-lg);
    max-height: 50vh;
    min-height: 40vh;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* Drag-affordance pill. 32x4 centered near the top edge. Not an
     interactive drag handle in this pass — purely a conventional
     "this is a sheet you can dismiss" signal. Uses --c-midgrey so it
     reads as a subtle indicator, not a button. */
  .handle {
    width: 32px;
    height: 4px;
    border-radius: var(--rounded);
    background: var(--c-midgrey);
    margin: 8px auto 0;
    flex-shrink: 0;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* Form-control compactness is handled per-component via the pane context —
     see $lib/shared/components/paneContext. No `:global()` overrides here. */
</style>
