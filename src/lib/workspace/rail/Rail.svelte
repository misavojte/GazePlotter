<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { cubicInOut } from 'svelte/easing'
  import type { GridItemSnapshot } from '$lib/workspace'
  import { PANE_TRANSITION, slideFlex } from '../pane/transition'
  import { responsive } from '../responsive.svelte'
  import {
    createRailItems,
    createEditPlotRailItem,
    type RailVisualization,
  } from './config'
  import { plotRegistry } from '$lib/plots/registry'
  import RailItem from './RailItem.svelte'
  import RailZoomSlider from './RailZoomSlider.svelte'
  import X from 'lucide-svelte/icons/x'

  interface Props {
    visualizations?: RailVisualization[]
    initialLayoutState?: GridItemSnapshot[] | null
    zoom?: number
    /**
     * Optional override for the "Add Visualization" action. Workspace
     * passes a handler that enters placement mode so the user picks
     * the target cell for the new item. When omitted, falls back to
     * the previous auto-placement behavior via workspace.addVisualization.
     */
    onAddVisualization?: (vizType: string) => void
  }

  // Suppresses the very first intro animation. `|global` transitions
  // would otherwise fire on initial mount, making the rail "activate"
  // from off-screen on app load — we want it already in place. Flipped
  // to true in onMount so every *subsequent* intro (after the user
  // opens/closes a pane) animates normally.
  let mounted = $state(false)

  let bannerHeight = $state(0)
  // Desktop layout uses sticky positioning anchored to the top of the
  // viewport with a small upward offset (-24px) so icons align with the
  // bordered workspace chrome. Mobile anchors to its own row-in-flex
  // and has no banner to clear.
  let toolbarTop = $derived(bannerHeight - 24)

  function detectOnScrollBannerHeight() {
    const banner = document.querySelector('.scroll-banner')
    if (banner) {
      bannerHeight = (banner as HTMLElement).offsetHeight
    }
  }

  let {
    visualizations = [],
    initialLayoutState = null,
    zoom = $bindable(1),
    onAddVisualization,
  }: Props = $props()
  const { errorService, ingest, engine, workspace, grid } =
    getGazePlotterSession()

  const isMobile = $derived(responsive.isMobile)

  // Rail content mode. Desktop is always 'workspace' — selecting a plot
  // retracts the rail entirely (no contents visible). Mobile introduces
  // a 'plot' mode: when a plot is selected but the sheet hasn't been
  // opened yet, the rail swaps to a single Edit action so the two-step
  // select → open-settings flow has an obvious trigger without a
  // separate floating affordance. If the sheet is open on mobile, the
  // rail is hidden entirely (see isHidden below) — 'plot' mode only
  // applies during the intermediate selected-but-not-yet-open state.
  const mode = $derived<'workspace' | 'plot'>(
    isMobile && grid.selectedItemId !== null ? 'plot' : 'workspace'
  )

  // Drives the rail's slide-out.
  // Desktop: rail retracts as soon as a plot is selected — selection
  // and pane-open are atomic on desktop so the rail steps aside for
  // the pane taking over the right edge.
  // Mobile: rail stays visible during the intermediate selected state
  // (swapping to an Edit action instead), and only hides once the
  // sheet actually opens — otherwise the user would lose their
  // workspace toolbar without an obvious path back.
  const isHidden = $derived(
    isMobile ? grid.paneOpenId !== null : grid.selectedItemId !== null
  )

  const isProcessing = $derived(ingest.isLoading)
  const isValidData = $derived(engine.hasValidData)
  const canUndo = $derived(workspace.canUndo)
  const canRedo = $derived(workspace.canRedo)

  const filteredVisualizations = $derived(
    visualizations.filter(v => {
      const config = plotRegistry[v.id as keyof typeof plotRegistry]
      return engine.hasCapabilities(config?.requireCapabilities)
    })
  )

  const undoLabel: string | null = $derived(workspace.lastUndoLabel)
  const redoLabel: string | null = $derived(workspace.lastRedoLabel)

  const handleUndo = () => {
    workspace.undo()
  }

  const handleRedo = () => {
    workspace.redo()
  }

  const handleResetLayout = () => {
    if (!initialLayoutState) {
      errorService.report({
        origin: 'workspace',
        severity: 'recoverable',
        userMessage: 'The initial workspace layout is unavailable.',
        cause: new Error(
          'Cannot reset layout: no initial layout state provided'
        ),
        context: {
          component: 'WorkspaceToolbar',
        },
      })
      return
    }
    workspace.resetLayout(initialLayoutState)
  }

  function handleEditPlot() {
    if (grid.selectedItemId !== null) {
      grid.openPane(grid.selectedItemId)
    }
  }

  function handleDeselect() {
    grid.setSelectedItem(null)
  }

  const workspaceRailItems = $derived.by(() =>
    createRailItems({
      undoLabel,
      redoLabel,
      canUndo,
      canRedo,
      isProcessing,
      isValidData,
      visualizations: filteredVisualizations,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onResetLayout: handleResetLayout,
      onAddVisualization: id =>
        onAddVisualization
          ? onAddVisualization(id)
          : workspace.addVisualization(id, 'toolbar'),
    })
  )

  const editRailItem = $derived(createEditPlotRailItem(handleEditPlot))

  onMount(() => {
    // Detect synchronously so `toolbarTop` is correct on the very first
    // frame when the rail re-mounts after being hidden by a pane
    // selection — otherwise the enter animation would start with a
    // stale bannerHeight of 0 and snap into place only once the user
    // next scrolls.
    detectOnScrollBannerHeight()
    mounted = true
    window.addEventListener('scroll', detectOnScrollBannerHeight, {
      passive: true,
    })
    return () => {
      window.removeEventListener('scroll', detectOnScrollBannerHeight)
    }
  })
</script>

{#if !isHidden}
  <!-- Desktop uses slideFlex on the x-axis (retract from the flex row
       into the pane's space, matching Pane.svelte's entry). Mobile is
       fixed-positioned so flex-basis animation has no effect — we
       translate-down instead via fly, with a 320ms intro delay so the
       sheet has fully descended before the rail returns. -->
  {#if isMobile}
    <!-- |global modifier: without it, these transitions would be local
         to this inner {:if isMobile} branch and never fire when the
         outer {#if !isHidden} toggles (Svelte's default local
         transitions don't fire on ancestor-block toggles). -->
    <div
      class="rail horizontal"
      in:fly|global={{
        y: 56,
        duration: mounted ? PANE_TRANSITION.duration : 0,
        delay: mounted ? PANE_TRANSITION.duration : 0,
        easing: PANE_TRANSITION.easing,
      }}
      out:fly|global={{
        y: 56,
        duration: PANE_TRANSITION.duration,
        easing: PANE_TRANSITION.easing,
      }}
    >
      {@render railBody()}
    </div>
  {:else}
    <div
      class="rail"
      in:slideFlex|global={{
        axis: 'x',
        duration: mounted ? PANE_TRANSITION.duration : 0,
        easing: PANE_TRANSITION.easing,
      }}
      out:slideFlex|global={{
        axis: 'x',
        duration: PANE_TRANSITION.duration,
        easing: PANE_TRANSITION.easing,
      }}
    >
      {@render railBody()}
    </div>
  {/if}
{/if}

{#snippet railBody()}
  {#if isMobile}
    <!-- Mobile: rail-content is a plain bottom-docked flex row. The
         mode-swap animation lives on an inner wrapper so workspace ⇄
         plot-selected content can transition independently of the
         outer rail sliding in/out. -->
    <div class="rail-content">
      {#key mode}
        <!-- Sequential mode swap: outgoing set slides 8px down while
             fading out (140ms), then incoming set rises from 8px
             below while fading in (180ms, delayed by the outro). No
             DOM-overlap window so the flex center stays put. -->
        <div
          class="rail-inner horizontal"
          in:fly={{ y: 8, duration: 180, delay: 140, easing: cubicInOut }}
          out:fly={{ y: 8, duration: 140, easing: cubicInOut }}
        >
          {#if mode === 'workspace'}
            {#each workspaceRailItems as item (item.id)}
              {#if item.id === 'add-visualization'}
                <div class="divider horizontal"></div>
              {/if}
              <RailItem
                label={item.label}
                icon={item.icon}
                actions={item.actions}
                disabled={item.disabled}
              />
            {/each}

            <div class="zoom-slot horizontal">
              <div class="divider horizontal"></div>
              <RailZoomSlider
                bind:value={zoom}
                disabled={isProcessing || !isValidData}
                orientation="horizontal"
              />
            </div>
          {:else}
            <RailItem
              label={editRailItem.label}
              icon={editRailItem.icon}
              actions={editRailItem.actions}
              disabled={editRailItem.disabled}
              showLabel
            />
            <div class="divider horizontal"></div>
            <RailItem
              label="Deselect"
              icon={X}
              actions={[{ label: 'Deselect', run: handleDeselect }]}
              showLabel
            />
          {/if}
        </div>
      {/key}
    </div>
  {:else}
    <!-- Desktop: original layout — rail items live directly inside
         rail-content with no inner wrapper, so the zoom slot's
         `margin-top: auto` can push against rail-content's padding
         and dock the slider to the bottom of the rail. -->
    <div class="rail-content" style="top: {toolbarTop}px;">
      {#each workspaceRailItems as item (item.id)}
        {#if item.id === 'add-visualization'}
          <div class="divider"></div>
        {/if}
        <RailItem
          label={item.label}
          icon={item.icon}
          actions={item.actions}
          disabled={item.disabled}
        />
      {/each}

      <div class="zoom-slot">
        <div class="divider"></div>
        <RailZoomSlider
          bind:value={zoom}
          disabled={isProcessing || !isValidData}
          orientation="vertical"
        />
      </div>
    </div>
  {/if}
{/snippet}

<style>
  /* Desktop variant: vertical strip docked at the right edge of the
     workspace flex row. Fixed 40px basis; content pins to the right
     edge so when the rail retracts (flex-basis → 0), the icons track
     the sliding right edge rather than appearing frozen at the left. */
  .rail {
    flex: 0 0 40px;
    width: 40px;
    align-self: stretch;
    background-color: var(--c-lightgrey, #f1f5f9);
    z-index: 2;
    transition: background-color 0.3s ease;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  /* Mobile variant: horizontal strip docked at the bottom of the
     workspace via `position: sticky`. Scoped to the workspace-body
     container — sticks to the viewport bottom while the workspace is
     in view, and scrolls out with the workspace once the user
     scrolls past it on the main page. Last item in the flex-column
     on mobile (see Workspace.svelte's .workspace-body.mobile rule)
     so its natural bottom-of-column position anchors the sticky. */
  .rail.horizontal {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    flex: 0 0 auto;
    height: calc(44px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    flex-direction: row;
    border-top: 1px solid var(--c-border);
    z-index: 2;
  }

  .rail-content {
    position: sticky;
    top: unset; /* unset as it is set by the banner height */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 44px 0;
    gap: 12px;
    /* Pin to the right edge of the animated container so the content
       tracks the sliding edge (overflowing leftward) rather than staying
       anchored to the static left edge and looking frozen. */
    align-self: flex-end;
    min-width: 40px;
  }

  /* Horizontal layout: the mobile rail swaps its rail-inner contents
     between workspace-mode and plot-selected mode via a keyed block.
     Svelte 5 keyed blocks mount the incoming branch and unmount the
     outgoing branch concurrently — both occupy the DOM during the
     transition overlap. A row-flex parent would then briefly hold
     two flex items side-by-side, shoving the center off to one side
     until the outgoing one unmounts.
     Using CSS Grid with a single 1×1 cell solves this: both
     rail-inner instances land in the same cell via `grid-area: 1/1`,
     stacking on top of each other and staying centered independently
     of one another. No layout shift during the mode swap. */
  .rail.horizontal .rail-content {
    position: static;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    place-items: center;
    width: 100%;
    height: 100%;
    padding: 0 12px;
    align-self: stretch;
    min-width: 0;
  }

  .rail-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .rail-inner.horizontal {
    /* Both the outgoing and incoming rail-inner during a mode swap
       share this single grid cell, stacking on each other while both
       remain centered. */
    grid-column: 1;
    grid-row: 1;
    flex-direction: row;
    gap: 10px;
    width: auto;
    max-width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .rail-inner.horizontal::-webkit-scrollbar {
    display: none;
  }

  /* Vertical divider: 16px wide, 1px tall — the horizontal strip used
     between desktop rail groups. On mobile it rotates to a 1px wide,
     16px tall vertical strip between row items. */
  .divider {
    width: 16px;
    height: 1px;
    background-color: #e2e8f0;
    margin: 4px 0;
  }

  .divider.horizontal {
    width: 1px;
    height: 16px;
    margin: 0 4px;
  }

  /* The zoom slot lives at the end of the rail — bottom on desktop,
     right on mobile. margin-top: auto pushes it to the end on desktop
     (column flex); on mobile the margin is reset and the slot sits
     naturally at the end of the row. */
  .zoom-slot {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .zoom-slot.horizontal {
    margin-top: 0;
    margin-left: auto;
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
</style>
