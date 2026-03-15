<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { onMount } from 'svelte'
  import { metadataInfoModal } from '$lib/modals/definitions'
  import type { GridItemSnapshot } from '$lib/workspace'
  import { createRailItems, type RailVisualization } from './config'
  import RailItem from './RailItem.svelte'

  interface Props {
    visualizations?: RailVisualization[]
    initialLayoutState?: GridItemSnapshot[] | null
  }

  let bannerHeight = $state(0)
  let toolbarTop = $derived(bannerHeight - 24) // for the better alignment in scrolls

  function detectOnScrollBannerHeight() {
    const banner = document.querySelector('.scroll-banner')
    if (banner) {
      bannerHeight = (banner as HTMLElement).offsetHeight
    }
  }

  let { visualizations = [], initialLayoutState = null }: Props = $props()
  const { errorService, ingest, engine, modalState, workspace } =
    getGazePlotterSession()

  const isProcessing = $derived(ingest.isLoading)
  const isValidData = $derived(engine.hasValidData)
  const canUndo = $derived(workspace.canUndo)
  const canRedo = $derived(workspace.canRedo)

  const undoLabel: string | null = $derived(workspace.lastUndoLabel)
  const redoLabel: string | null = $derived(workspace.lastRedoLabel)

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'z' && event.ctrlKey) {
      handleUndo()
    } else if (event.key === 'y' && event.ctrlKey) {
      handleRedo()
    }
  }

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
      visualizations,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onResetLayout: handleResetLayout,
      onAddVisualization: id => workspace.addVisualization(id, 'toolbar'),
    })
  )

  onMount(() => {
    window.addEventListener('scroll', detectOnScrollBannerHeight, {
      passive: true,
    })
    document.addEventListener('keydown', handleKeydown, { passive: true })
    return () => {
      window.removeEventListener('scroll', detectOnScrollBannerHeight)
      document.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div class="rail">
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
  </div>
</div>

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
  }

  .rail-content {
    position: sticky;
    top: unset; /* unset as it is set by the banner height */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 44px 0;
    gap: 12px;
  }

  .divider {
    width: 16px;
    height: 1px;
    background-color: #e2e8f0;
    margin: 4px 0;
  }
</style>
