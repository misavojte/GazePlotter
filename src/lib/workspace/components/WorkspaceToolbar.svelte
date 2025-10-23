<script lang="ts">
  import { canRedo, canUndo, endUndoRedo, redo, undo, WorkspaceToolbarItem } from '$lib/workspace'
  import { processingFileStateStore } from '$lib/workspace/stores/fileStore'
  import { hasValidData } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onMount } from 'svelte'
  import type { WorkspaceCommand, WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'

  // Configuration for toolbar items
  interface Props {
    accentColor?: string
    onaction: (event: { id: string; event?: any }) => void
    visualizations?: Array<{ id: string; label: string }>
    onWorkspaceCommand: (command: WorkspaceCommand | WorkspaceCommandChain) => void
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
    onaction = () => {},
    visualizations = [], // Default empty array for visualizations
    onWorkspaceCommand,
  }: Props = $props()

  // Reactive variables to determine item states
  const isProcessing = $derived($processingFileStateStore === 'processing')
  const isValidData = $derived($hasValidData)

  /**
   * Configuration for toolbar items with their disable rules.
   * Each item specifies when it should be disabled via a function.
   */
  const toolbarItems = $derived([
    {
      id: 'undo',
      label: 'Undo',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6"></path>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
        </svg>`,
      actions: [{ id: 'undo', label: 'Undo' }],
      disabled: !$canUndo,
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 7v6h-6"></path>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
        </svg>`,
      actions: [{ id: 'redo', label: 'Redo' }],
      disabled: !$canRedo,
    },
    {
      id: 'reset-layout',
      label: 'Reset Layout',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 2v6h6"></path>
          <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
          <path d="M21 22v-6h-6"></path>
          <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
        </svg>`,
      actions: [{ id: 'reset-layout', label: 'Reset Layout' }],
      // Disable when processing or no valid data (layout requires data to exist)
      disabled: isProcessing || !isValidData,
    },
    {
      id: 'add-visualization',
      label: 'Add Visualization',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>`,
      actions: visualizations.map(viz => ({ id: viz.id, label: viz.label })),
      // Disable when processing or no valid data (visualizations need data to display)
      disabled: isProcessing || !isValidData,
    },
    {
      id: 'toggle-fullscreen',
      label: 'Toggle Fullscreen',
      icon: isFullscreen
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
          </svg>`,
      actions: [{ id: 'toggle-fullscreen', label: 'Toggle Fullscreen' }],
      // Fullscreen is always available regardless of data state
      disabled: false,
    },
    {
      id: 'metadata',
      label: 'Source Metadata',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
      actions: [{ id: 'metadata', label: 'Source Metadata' }],
      // Metadata modal should be accessible even without valid data
      disabled: isProcessing,
    },
  ])

  /**
   * Handles toolbar item clicks.
   * Delegates fullscreen toggle internally, then propagates the action upward.
   */
  const handleItemClick = (event: { id: string; event?: any }): void => {
    if (event.id === 'toggle-fullscreen') {
      toggleFullscreen()
    } else if (event.id === 'undo') {
      handleUndo()
    } else if (event.id === 'redo') {
      handleRedo()
    }

    onaction({
      id: event.id,
      event: event.event,
    })
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
    {#each toolbarItems as item}
      <WorkspaceToolbarItem
        id={item.id}
        label={item.label}
        icon={item.icon}
        actions={item.actions}
        disabled={item.disabled}
        onclick={handleItemClick}
      />
    {/each}
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
