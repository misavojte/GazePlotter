<script lang="ts">
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { fade } from 'svelte/transition'
  import { writable } from 'svelte/store'
  import WorkspaceToolbarItem from './WorkspaceToolbarItem.svelte'

  // Configuration for toolbar items
  interface Props {
    actionItems?: any
    width?: string
    accentColor?: string
    onaction?: (event: { id: string; vizType?: string; event?: any }) => void
    visualizations?: Array<{ id: string; label: string }>
  }

  let {
    actionItems = [
      {
        id: 'reset-layout',
        label: 'Reset Layout',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 2v6h6"></path>
            <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
            <path d="M21 22v-6h-6"></path>
            <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
          </svg>`,
        action: () => {
          processingFileStateStore.set('done')
        },
      },
      {
        id: 'add-visualization',
        label: 'Add Visualization',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
          </svg>`,
        action: null, // Will be handled by context menu
      },
      {
        id: 'toggle-fullscreen',
        label: 'Toggle Fullscreen',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
          </svg>`,
        action: null, // Will be handled by parent component
      },
    ],
    width = '48px',
    accentColor = 'var(--c-primary)',
    onaction = () => {},
    visualizations = [], // Default empty array for visualizations
  }: Props = $props()

  // Create a store for context menu
  const contextMenuState = writable({
    visible: false,
    x: 0,
    y: 0,
  })

  let addVisualizationButton: HTMLElement

  function handleVisualizationSelect(vizType: string) {
    onaction({
      id: 'add-visualization',
      vizType,
    })
    contextMenuState.set({ visible: false, x: 0, y: 0 })
  }

  // Function to toggle context menu
  function toggleContextMenu(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (addVisualizationButton) {
      const rect = addVisualizationButton.getBoundingClientRect()
      contextMenuState.update(state => ({
        visible: !state.visible,
        x: rect.right + 5,
        y: rect.top,
      }))
    }
  }

  // Handle toolbar item click
  function handleItemClick(event: { id: string; event?: any }) {
    if (event.id === 'add-visualization') {
      toggleContextMenu(event.event as MouseEvent)
      return
    }

    onaction({
      id: event.id,
      event: event.event,
    })
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    contextMenuState.set({ visible: false, x: 0, y: 0 })
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div
  class="workspace-toolbar"
  style="--toolbar-width: {width}; --accent-color: {accentColor};"
>
  <div class="toolbar-content">
    {#if actionItems.length > 0}
      <!-- Reset Layout button -->
      <WorkspaceToolbarItem
        id="reset-layout"
        label={actionItems[0].label}
        icon={actionItems[0].icon}
        action={actionItems[0].action}
        onclick={handleItemClick}
      />

      <!-- Add Visualization button with dropdown -->
      <div bind:this={addVisualizationButton}>
        <WorkspaceToolbarItem
          id="add-visualization"
          label={actionItems[1].label}
          icon={actionItems[1].icon}
          onclick={handleItemClick}
        />
      </div>

      <!-- Fullscreen toggle button -->
      <WorkspaceToolbarItem
        id="toggle-fullscreen"
        label={actionItems[2].label}
        icon={actionItems[2].icon}
        onclick={handleItemClick}
      />
    {/if}
  </div>
</div>

{#if $contextMenuState.visible}
  <div
    class="context-menu"
    style="left: {$contextMenuState.x}px; top: {$contextMenuState.y}px;"
    transition:fade={{ duration: 100 }}
    onclick={event => event.stopPropagation()}
  >
    {#each visualizations as viz}
      <button
        class="context-menu-item"
        onclick={() => handleVisualizationSelect(viz.id)}
      >
        {viz.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .workspace-toolbar {
    position: relative;
    top: 0;
    left: 0;
    width: var(--toolbar-width);
    height: 100%;
    background-color: var(--c-grey);
    z-index: 2;
    transition: background-color 0.3s ease;
  }

  .toolbar-content {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 22px 0;
  }

  .context-menu {
    position: fixed;
    background: white;
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 2100;
    min-width: 160px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    pointer-events: auto;
    isolation: isolate; /* Create a new stacking context */
    contain: layout; /* Optimize rendering */
  }

  .context-menu-item {
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    color: var(--c-text-dark);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .context-menu-item:hover {
    background-color: var(--c-lightgrey);
  }

  .context-menu-item:active {
    background-color: var(--c-grey);
  }
</style>
