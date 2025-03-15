<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { createDropdownMenu, melt } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'
  import WorkspaceToolbarItem from './WorkspaceToolbarItem.svelte'

  // Configuration for toolbar items
  export let actionItems = [
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
  ]
  export let width = '48px'
  export let accentColor = 'var(--c-primary)'
  // Add a new prop to track dragging state
  export let isDragging = false
  export let dragOverTrash = false

  // Create dropdown menu using melt-ui
  const {
    elements: { trigger, menu, item },
    states: { open },
  } = createDropdownMenu({
    positioning: {
      placement: 'right-start',
      gutter: 13,
      strategy: 'fixed',
    },
    portal: true, // Ensure menu is portalled to body
    preventScroll: false, // Allow scrolling of the main window
  })

  // Available visualizations
  const visualizations = [
    { id: 'scarf', label: 'Scarf Plot' },
    // Add more visualization types here as they become available
  ]

  // Event dispatcher for toolbar actions
  const dispatch = createEventDispatcher()

  function handleVisualizationSelect(vizType: string) {
    dispatch('action', { id: 'add-visualization', vizType })
    $open = false
  }

  // Handle toolbar item click
  function handleItemClick(event) {
    const { id } = event.detail
    dispatch('action', { id, event: event.detail.event })
  }

  // Track when an item is dragged over the trash area
  // Only track when hovering over the icon specifically, not the entire toolbar
  function handleTrashIconEnter() {
    if (isDragging) {
      dragOverTrash = true
      dispatch('trash-dragenter')
    }
  }

  function handleTrashIconLeave() {
    if (isDragging) {
      dragOverTrash = false
      dispatch('trash-dragleave')
    }
  }
</script>

<div
  class="workspace-toolbar"
  class:dragging={isDragging}
  style="--toolbar-width: {width}; --accent-color: {accentColor};"
>
  <div class="toolbar-content">
    {#if isDragging}
      <div class="trash-container">
        <!-- The trash icon is the only drop target -->
        <div
          class="trash-icon"
          class:drag-over={dragOverTrash}
          on:mouseenter={handleTrashIconEnter}
          on:mouseleave={handleTrashIconLeave}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            ></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </div>
        <!-- Space reserved for future options like bookmarks -->
        <div class="future-options-space"></div>
      </div>
    {:else if actionItems.length > 0}
      <!-- Reset Layout button -->
      <WorkspaceToolbarItem
        id="reset-layout"
        label={actionItems[0].label}
        icon={actionItems[0].icon}
        action={actionItems[0].action}
        on:click={handleItemClick}
      />

      <!-- Add Visualization button with dropdown -->
      <WorkspaceToolbarItem
        id="add-visualization"
        label={actionItems[1].label}
        icon={actionItems[1].icon}
        useDropdown={true}
        dropdownTrigger={$trigger}
      />
    {/if}
  </div>
</div>

{#if $open}
  <div
    class="context-menu"
    use:melt={$menu}
    transition:fade={{ duration: 100 }}
  >
    {#each visualizations as viz}
      <button
        class="context-menu-item"
        use:melt={$item}
        on:click={() => handleVisualizationSelect(viz.id)}
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
    z-index: 2000;
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

  /* Trash container styles */
  .trash-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 10px 0;
  }

  /* The trash icon is now the only drop target, with clear visual feedback */
  .trash-icon {
    position: sticky;
    top: 20px;
    width: 36px;
    height: 76px; /* Elongated height */
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e74c3c;
    background-color: rgba(231, 76, 60, 0.08);
    border: 2px dashed rgba(231, 76, 60, 0.3);
    border-radius: 8px;
    margin-bottom: 15px;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  /* Visual feedback when dragging over the trash icon specifically */
  .trash-icon.drag-over {
    background-color: rgba(231, 76, 60, 0.2);
    border-color: #e74c3c;
    transform: scale(1.05);
    box-shadow: 0 0 8px rgba(231, 76, 60, 0.3);
  }

  .trash-icon svg {
    height: 24px;
    width: 24px;
    transition: transform 0.2s ease;
  }

  .trash-icon.drag-over svg {
    transform: scale(1.1);
  }

  /* Reserved space for future features */
  .future-options-space {
    height: 60px; /* Reserve space for future options */
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

  /* Create a portal container for the menu */
  :global(body > [data-portal]) {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 0; /* Set height to 0 to prevent scroll blocking */
    pointer-events: none; /* Let scroll events pass through */
    z-index: 2100;
  }

  /* Only enable pointer events on the actual menu */
  :global(body > [data-portal] > *) {
    pointer-events: auto;
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
