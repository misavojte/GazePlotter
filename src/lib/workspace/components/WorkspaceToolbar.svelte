<script lang="ts">
  import { canRedo, canUndo, endUndoRedo, redo, undo, WorkspaceToolbarItem } from '$lib/workspace'
  import { processingFileStateStore } from '$lib/workspace/stores/fileStore'
  import { hasValidData } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onMount } from 'svelte'
  import type { WorkspaceCommand, WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
  import { createRootCommand } from '$lib/shared/types/workspaceInstructions'
  import { ModalContentMetadataInfo } from '$lib/modals'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { generateUniqueId } from '$lib/shared/utils/idUtils'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'

  // Configuration for toolbar items
  interface Props {
    accentColor?: string
    visualizations?: Array<{ id: string; label: string }>
    onWorkspaceCommand: (command: WorkspaceCommand | WorkspaceCommandChain) => void
    initialLayoutState?: Array<Partial<AllGridTypes> & { type: string }> | null
  }

  // Track fullscreen state
  let isFullscreen = $state(false)

  // Function to toggle fullscreen mode
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          isFullscreen = true
        })
        .catch(err => {
          console.error('Error attempting to enable fullscreen:', err)
        })
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            isFullscreen = false
          })
          .catch(err => {
            console.error('Error attempting to exit fullscreen:', err)
          })
      }
    }
  }

  // Listen for fullscreen change events
  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement
  }

  let {
    accentColor = 'var(--c-primary)',
    visualizations = [], // Default empty array for visualizations
    onWorkspaceCommand,
    initialLayoutState = null,
  }: Props = $props()

  // Reactive variables to determine item states
  const isProcessing = $derived($processingFileStateStore === 'processing')
  const isValidData = $derived($hasValidData)


  /**
   * Handles toolbar item clicks directly.
   * Each action is handled internally without delegation.
   */
  const handleItemClick = (event: { id: string; event?: any }): void => {
    if (event.id === 'toggle-fullscreen') {
      toggleFullscreen()
    } else if (event.id === 'undo') {
      handleUndo()
    } else if (event.id === 'redo') {
      handleRedo()
    } else if (event.id === 'reset-layout') {
      handleResetLayout()
    } else if (event.id === 'metadata') {
      // Open the metadata info modal directly
      modalStore.open(
        ModalContentMetadataInfo as any,
        'Metadata Report',
        {}
      )
    } else if (visualizations.map(viz => viz.id).includes(event.id)) {
      // Handle visualization addition
      const vizType = event.id
      onWorkspaceCommand({
        type: 'addGridItem',
        vizType,
        itemId: generateUniqueId()
      })
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'z' && event.ctrlKey) {
      handleUndo()
    } else if (event.key === 'y' && event.ctrlKey) {
      handleRedo()
    }
  }

  const handleUndo = () => {
    const arrayOfCommands = undo()
    if (!arrayOfCommands) return
    arrayOfCommands.forEach(command => {
      onWorkspaceCommand(command)
    })
    endUndoRedo()
  }

  const handleRedo = () => {
    const arrayOfCommands = redo()
    if (!arrayOfCommands) return
    arrayOfCommands.forEach(command => {
      onWorkspaceCommand(command)
    })
    endUndoRedo()
  }

  /**
   * Handles layout reset by creating a setLayoutState command with the initial layout state.
   * This replaces the direct callback approach with a proper workspace command.
   */
  const handleResetLayout = () => {
    if (!initialLayoutState) {
      console.warn('Cannot reset layout: no initial layout state provided')
      return
    }

    // Create a setLayoutState command with the initial layout state
    const resetCommand = createRootCommand({
      type: 'setLayoutState',
      layoutState: initialLayoutState
    })

    onWorkspaceCommand(resetCommand)
  }

  // Listen for fullscreen state changes from browser events
  onMount(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />
<div class="workspace-toolbar" style="--accent-color: {accentColor};">
  <div class="toolbar-content">
    <!-- Undo button -->
    <WorkspaceToolbarItem
      id="undo"
      label="Undo"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6"></path>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
        </svg>`}
      actions={[{ id: 'undo', label: 'Undo' }]}
      disabled={!$canUndo}
      onclick={handleItemClick}
    />

    <!-- Redo button -->
    <WorkspaceToolbarItem
      id="redo"
      label="Redo"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 7v6h-6"></path>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
        </svg>`}
      actions={[{ id: 'redo', label: 'Redo' }]}
      disabled={!$canRedo}
      onclick={handleItemClick}
    />

    <!-- Reset Layout button -->
    <WorkspaceToolbarItem
      id="reset-layout"
      label="Reset Layout"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 2v6h6"></path>
          <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
          <path d="M21 22v-6h-6"></path>
          <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
        </svg>`}
      actions={[{ id: 'reset-layout', label: 'Reset Layout' }]}
      disabled={isProcessing || !isValidData}
      onclick={handleItemClick}
    />

    <!-- Add Visualization button -->
    <WorkspaceToolbarItem
      id="add-visualization"
      label="Add Visualization"
      icon={`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>`}
      actions={visualizations.map(viz => ({ id: viz.id, label: viz.label }))}
      disabled={isProcessing || !isValidData}
      onclick={handleItemClick}
    />

    <!-- Toggle Fullscreen button -->
    <WorkspaceToolbarItem
      id="toggle-fullscreen"
      label="Toggle Fullscreen"
      icon={isFullscreen
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>`}
      actions={[{ id: 'toggle-fullscreen', label: 'Toggle Fullscreen' }]}
      disabled={false}
      onclick={handleItemClick}
    />

    <!-- Metadata button -->
    <WorkspaceToolbarItem
      id="metadata"
      label="Source Metadata"
      icon={`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`}
      actions={[{ id: 'metadata', label: 'Source Metadata' }]}
      disabled={isProcessing}
      onclick={handleItemClick}
    />
  </div>
</div>

<style>
  .workspace-toolbar {
    position: absolute;
    top: 0;
    left: 0;
    width: 46px;
    height: 100%;
    background-color: var(--c-lightgrey, #eaeaea);
    z-index: 2;
    transition: background-color 0.3s ease;
    border-right: 1px solid #88888862;
    box-sizing: border-box;
  }

  .toolbar-content {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 17px 0;
    gap: 4px;
  }
</style>
