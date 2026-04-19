<script lang="ts">
  import { onMount } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { plotRegistry, getPlotDisplayName } from '$lib/plots/registry'
  import PaneHeader from './PaneHeader.svelte'
  import PaneQuickActions from './PaneQuickActions.svelte'
  import PaneSheet from './PaneSheet.svelte'
  import { PANE_TRANSITION, slideFlex } from './transition'
  import { responsive } from '../responsive.svelte'

  const { grid } = getGazePlotterSession()

  // Pane/sheet visibility is driven by paneOpenId (explicitly opened by a
  // click on desktop or by the mobile FAB). Selection alone no longer
  // implies the pane is open — that decoupling is what enables the
  // two-step mobile flow while leaving desktop behavior unchanged (the
  // click handler sets both state fields together on desktop).
  const paneItem = $derived(
    grid.paneOpenId === null
      ? null
      : (grid.items.find(i => i.id === grid.paneOpenId) ?? null)
  )

  const definition = $derived(
    paneItem ? (plotRegistry as Record<string, any>)[paneItem.type] : null
  )

  const PaneSettings = $derived(definition?.paneSettings ?? null)

  const title = $derived(paneItem ? getPlotDisplayName(paneItem.type) : '')

  // Desktop: closing the pane also deselects (setSelectedItem(null)
  // clears paneOpenId transitively). Mobile: keep the plot selected so
  // the FAB returns and the user can still drag — closePane() only
  // closes the sheet.
  function close() {
    if (responsive.isMobile) {
      grid.closePane()
    } else {
      grid.setSelectedItem(null)
    }
  }

  // Match Rail.svelte:17-24 viewport-anchoring mechanism so the pane's
  // content stays in view when the page is scrolled down. Unlike the rail
  // (which offsets -24px for its icon-only layout), the pane must stick
  // flush with the viewport top so the title isn't clipped.
  let bannerHeight = $state(0)
  let contentTop = $derived(bannerHeight)

  function detectOnScrollBannerHeight() {
    const banner = document.querySelector('.scroll-banner')
    if (banner) {
      bannerHeight = (banner as HTMLElement).offsetHeight
    }
  }

  onMount(() => {
    detectOnScrollBannerHeight()
    window.addEventListener('scroll', detectOnScrollBannerHeight, {
      passive: true,
    })
    return () =>
      window.removeEventListener('scroll', detectOnScrollBannerHeight)
  })

  // Escape closes whichever surface is open (desktop pane or mobile
  // sheet). Keyed on paneItem so the listener detaches when nothing is
  // open, avoiding a global key handler that'd fire on every keystroke.
  $effect(() => {
    if (!paneItem) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

</script>

{#if responsive.isMobile}
  {#if paneItem && PaneSettings}
    <PaneSheet {title} onClose={close}>
      <PaneQuickActions item={paneItem} />
      <PaneSettings item={paneItem} />
    </PaneSheet>
  {/if}
{:else if paneItem && PaneSettings}
  <!-- Desktop side pane. Conditionally mounted with `slideFlex` on the
       x axis. We animate both `width` AND `flex-basis` — the built-in
       `slide` only animates width, which is silently ignored by a flex
       item whose container sets `flex: 0 0 <size>` (the fixed basis
       wins over width in the flex algorithm, so nothing visually moves).
       Duration/easing match Rail.svelte's slide-out so the two motions
       read as one sweep. -->
  <aside
    class="pane"
    aria-label={`${title} settings`}
    transition:slideFlex={{
      axis: 'x',
      duration: PANE_TRANSITION.duration,
      easing: PANE_TRANSITION.easing,
    }}
  >
    <div
      class="pane-content"
      style="top: {contentTop}px; max-height: calc(100vh - {contentTop}px);"
    >
      <PaneHeader {title} onClose={close} />
      <div class="body">
        <PaneQuickActions item={paneItem} />
        <PaneSettings item={paneItem} />
      </div>
    </div>
  </aside>
{/if}

<style>
  .pane {
    flex: 0 0 400px;
    align-self: stretch;
    background-color: var(--c-lightgrey);
    z-index: 2;
    box-sizing: border-box;
    border-left: 1px solid var(--c-border);
    border-top: 1px solid var(--c-border);
    transition: background-color 0.3s ease;
  }

  .pane-content {
    position: sticky;
    top: unset; /* set inline from bannerHeight */
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    /* Keep content at natural width so the animated outer container clips
       it rather than squishing it — gives a true slide feel. */
    min-width: 400px;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* Make form fields inside the pane fill the available width and align
     typography with PaneSection's small, muted label styling so controls
     read as a single form surface rather than a mix of floating widgets. */
  .body :global(.select-wrapper) {
    width: 100%;
  }
  .body :global(.input > label),
  .body :global(.group-container .legend) {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    letter-spacing: 0.01em;
    line-height: 1.2;
  }
  .body :global(.trigger) {
    height: 30px;
    font-size: 12px;
  }
</style>
