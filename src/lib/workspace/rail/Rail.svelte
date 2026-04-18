<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { onMount } from 'svelte'
  import type { GridItemSnapshot } from '$lib/workspace'
  import { PANE_TRANSITION, slideFlex } from '../pane/transition'
  import { createRailItems, type RailVisualization } from './config'
  import { plotRegistry } from '$lib/plots/registry'
  import RailItem from './RailItem.svelte'
  import RailZoomSlider from './RailZoomSlider.svelte'

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

  let bannerHeight = $state(0)
  let toolbarTop = $derived(bannerHeight - 24) // for the better alignment in scrolls

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
  const { errorService, ingest, engine, modalState, workspace, grid } =
    getGazePlotterSession()

  // Drives the rail's slide-out. When a grid item is selected for
  // configuration, the Pane takes over the right edge and we retract the
  // rail to the left — reducing cognitive load and ushering the eye from
  // the selected item toward the settings. The Pane uses the same
  // easing/duration so the two motions read as one coordinated sweep.
  const isHidden = $derived(grid.selectedItemId !== null)

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

  const railItems = $derived.by(() =>
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

  onMount(() => {
    // Detect synchronously so `toolbarTop` is correct on the very first
    // frame when the rail re-mounts after being hidden by a pane
    // selection — otherwise the enter animation would start with a
    // stale bannerHeight of 0 and snap into place only once the user
    // next scrolls.
    detectOnScrollBannerHeight()
    window.addEventListener('scroll', detectOnScrollBannerHeight, {
      passive: true,
    })
    return () => {
      window.removeEventListener('scroll', detectOnScrollBannerHeight)
    }
  })
</script>

{#if !isHidden}
<div
  class="rail"
  transition:slideFlex={{
    axis: 'x',
    duration: PANE_TRANSITION.duration,
    easing: PANE_TRANSITION.easing,
  }}
>
  <div class="rail-content" style="top: {toolbarTop}px;">
    {#each railItems as item (item.id)}
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
      />
    </div>
  </div>
</div>
{/if}

<style>
  .rail {
    /* Participate in the wrapper flex layout so it doesn't overlay the workspace */
    flex: 0 0 40px;
    width: 40px;
    align-self: stretch;
    background-color: var(--c-lightgrey, #f1f5f9);
    z-index: 2;
    transition: background-color 0.3s ease;
    box-sizing: border-box;
    /* Also act as a flex container so we can right-align .rail-content.
       Right-aligning means as the container's right edge slides leftward,
       the content tracks it (overflow goes left, off-screen) instead of
       staying pinned at the left edge and appearing stationary. */
    display: flex;
    flex-direction: column;
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

  .divider {
    width: 16px;
    height: 1px;
    background-color: #e2e8f0;
    margin: 4px 0;
  }

  .zoom-slot {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
