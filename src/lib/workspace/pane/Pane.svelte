<script lang="ts">
  import { onMount, setContext } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { plotRegistry, getPlotDisplayName } from '$lib/plots/registry'
  import { downloadPlotModal } from '$lib/modals/definitions'
  import PaneHeader from './PaneHeader.svelte'
  import PaneSection from './PaneSection.svelte'
  import PaneEditLink from './PaneEditLink.svelte'
  import PaneSheet from './PaneSheet.svelte'
  import PaneSectionList from './PaneSectionList.svelte'
  import BulkPaneSettings from './BulkPaneSettings.svelte'
  import { setPaneEditItems } from './paneEditItems'
  import { PANE_ACCORDION_KEY, type PaneAccordion } from './accordion'
  import { PANE_TRANSITION, slideFlex } from './transition'
  import { markInPane } from '$lib/shared/components/paneContext'
  import { responsive } from '../responsive.svelte'

  markInPane()

  // Shared open states for every PaneSection inside this Pane.
  // Opening or closing one section does not affect other sections.
  const accordion = $state<PaneAccordion>({ openStates: {} })
  setContext(PANE_ACCORDION_KEY, accordion)

  const { grid, modalState } = getGazePlotterSession()

  function openExport() {
    if (!paneItem) return
    modalState.open(downloadPlotModal, { item: paneItem as any })
  }

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

  const paneSections = $derived(definition?.paneSections ?? [])

  // Single-plot pane: sections edit just this item. (BulkPaneSettings overrides
  // this context for the multi-selection subtree.) Reactive via the getter.
  setPaneEditItems(() => (paneItem ? [paneItem] : []))

  const title = $derived(paneItem ? getPlotDisplayName(paneItem.type) : '')

  // Multi-selection (desktop): the pane shows the sections shared by every
  // selected plot for bulk editing, instead of one plot's full settings.
  // `selectedCount` is the single source — single vs bulk is just cardinality.
  const isBulk = $derived(grid.selectedCount > 1)
  const bulkTitle = $derived(`${grid.selectedCount} plots selected`)
  const desktopAriaLabel = $derived(
    isBulk ? 'Bulk plot settings' : `${title} settings`
  )

  // Desktop: closing the pane also deselects (setSelectedItem(null)/
  // clearSelection() clears paneOpenId transitively). Mobile: keep the plot
  // selected so the FAB returns and the user can still drag — closePane()
  // only closes the sheet.
  function close() {
    if (isBulk) {
      grid.clearSelection()
    } else if (responsive.isMobile) {
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

  // Escape closes whichever surface is open (desktop pane, bulk pane, or
  // mobile sheet). Keyed on paneItem/isBulk so the listener detaches when
  // nothing is open, avoiding a global key handler that'd fire on every keystroke.
  $effect(() => {
    if (!paneItem && !isBulk) return
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

{#snippet exportSection()}
  <PaneSection title="Export">
    <PaneEditLink onclick={openExport}>Download plot…</PaneEditLink>
  </PaneSection>
{/snippet}

<!-- Desktop pane body: bulk shared-sections when several plots are selected,
     otherwise the single plot's full settings. One shell, one transition —
     only the content branches on cardinality. -->
{#snippet desktopBody()}
  {#if isBulk}
    <PaneHeader title={bulkTitle} onClose={close} />
    <div class="body">
      <BulkPaneSettings items={grid.selectedItems} />
    </div>
  {:else if paneItem && paneSections.length}
    <PaneHeader {title} onClose={close} />
    <div class="body">
      <PaneSectionList sections={paneSections} item={paneItem} />
      {@render exportSection()}
    </div>
  {/if}
{/snippet}

{#if responsive.isMobile}
  {#if paneItem && paneSections.length}
    <PaneSheet {title} onClose={close}>
      <PaneSectionList sections={paneSections} item={paneItem} />
      {@render exportSection()}
    </PaneSheet>
  {/if}
{:else if isBulk || (paneItem && paneSections.length)}
  <!-- Desktop side pane. Conditionally mounted with `slideFlex` on the
       x axis. We animate both `width` AND `flex-basis` — the built-in
       `slide` only animates width, which is silently ignored by a flex
       item whose container sets `flex: 0 0 <size>` (the fixed basis
       wins over width in the flex algorithm, so nothing visually moves).
       Duration/easing match Rail.svelte's slide-out so the two motions
       read as one sweep. -->
  <aside
    class="pane"
    aria-label={desktopAriaLabel}
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
      {@render desktopBody()}
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

  /* Form-control compactness is handled by each component via `isInPane()`
     from $lib/shared/components/paneContext — the pane just signals the
     context with `markInPane()` in the script block. No `:global()` overrides. */
</style>
