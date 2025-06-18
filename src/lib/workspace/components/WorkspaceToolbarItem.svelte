<script lang="ts">
  import { tooltipAction } from '$lib/tooltip/components/Tooltip.svelte'
  import { writable } from 'svelte/store'
  import { fade } from 'svelte/transition'

  // Action item interface
  interface ActionItem {
    id: string
    label: string
  }

  // Props for the toolbar item
  interface Props {
    id: string
    label: string
    icon: string
    actions: ActionItem[] // Array of actions
    onclick?: (event: { id: string; event: MouseEvent }) => void
    disabled?: boolean
  }

  let {
    id,
    label,
    icon,
    actions = [],
    onclick = () => {},
    disabled = false,
  }: Props = $props()

  // Context menu state
  const contextMenuState = writable({
    visible: false,
    x: 0,
    y: 0,
  })

  let buttonElement: HTMLButtonElement | null = $state(null)

  // Handle item click
  function handleClick(event: MouseEvent) {
    if (disabled) return

    // If only one action, fire it immediately
    if (actions.length === 1) {
      onclick({
        id: actions[0].id,
        event,
      })
      return
    }

    // If multiple actions, show context menu
    if (actions.length > 1) {
      showContextMenu(event)
      return
    }

    // Fallback: fire the main action
    onclick({ id, event })
  }

  // Show context menu
  function showContextMenu(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect()
      contextMenuState.set({
        visible: true,
        x: rect.right + 5,
        y: rect.top,
      })
    }
  }

  // Handle action selection from context menu
  function handleActionSelect(action: ActionItem) {
    onclick({
      id: action.id,
      event: new MouseEvent('click'),
    })
    contextMenuState.set({ visible: false, x: 0, y: 0 })
  }

  // Close context menu
  function closeContextMenu() {
    contextMenuState.set({ visible: false, x: 0, y: 0 })
  }
</script>

<svelte:window onclick={closeContextMenu} />

<div class="tooltip-wrapper">
  <button
    bind:this={buttonElement}
    class="toolbar-item"
    class:disabled
    onclick={handleClick}
    {disabled}
    use:tooltipAction={{
      content: label,
      position: 'right',
      width: 100,
    }}
  >
    <div class="toolbar-item-icon">
      {@html icon}
    </div>
  </button>
</div>

{#if $contextMenuState.visible && !disabled && actions.length > 1}
  <div
    class="context-menu"
    style="left: {$contextMenuState.x}px; top: {$contextMenuState.y}px;"
    transition:fade={{ duration: 100 }}
  >
    {#each actions as action}
      <button
        class="context-menu-item"
        onclick={() => handleActionSelect(action)}
      >
        {action.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .tooltip-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-item {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    margin: 4px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--c-darkgrey, #666);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .toolbar-item:hover:not(.disabled) {
    background-color: var(--c-lightgrey, #eaeaea);
    color: var(--c-primary);
  }

  .toolbar-item.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .toolbar-item-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    isolation: isolate;
    contain: layout;
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
