<script lang="ts">
  import { fly, fade } from 'svelte/transition'
  import {
    contextMenuState,
    updateContextMenu,
  } from './contextMenuState.svelte'
  import { MENU_MAX_HEIGHT } from './const'
  import type { MenuItem } from './types'
  import ContextSubMenu from './ContextSubMenu.svelte'

  /** Close the context menu by clearing the global store. */
  const onClose = () => updateContextMenu(null)
  let width = 220
  let container: HTMLUListElement | null = $state(null)
  let menuElement: HTMLDivElement | null = $state(null)

  /**
   * Handle keyboard controls for the menu so it remains accessible.
   *
   * @param ev - Keyboard event emitted while the menu is open.
   */
  const onKeydown = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') onClose()
    if (ev.key === 'ArrowDown' && container) {
      ev.preventDefault()
      focusNext(1)
    }
    if (ev.key === 'ArrowUp' && container) {
      ev.preventDefault()
      focusNext(-1)
    }
  }

  /**
   * Move focus between menu items so the current selection follows keyboard navigation.
   *
   * @param delta - Offset used to calculate the next item in the loop.
   */
  const focusNext = (delta: number) => {
    if (!container) return
    // Gather buttons once so we can iterate in order without repeated DOM queries.
    const buttons = Array.from(
      container.querySelectorAll('button[role="menuitem"]')
    ) as HTMLButtonElement[]
    if (buttons.length === 0) return
    const idx = buttons.findIndex(
      b => b === (document.activeElement as HTMLButtonElement)
    )
    const next =
      ((idx >= 0 ? idx : -1) + delta + buttons.length) % buttons.length
    buttons[next].focus()
  }

  /**
   * Run the selected item's action before dismissing the menu.
   *
   * @param fn - Callback associated with the chosen menu entry.
   */
  const handleItemClick = (fn: () => void) => {
    fn()
    onClose()
  }

  let activeItemId = $state<MenuItem | null>(null)

  $effect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
</script>

{#if contextMenuState.current}
  <div
    bind:this={menuElement}
    class="menu"
    role="menu"
    in:fly={{
      duration: 140,
      y: contextMenuState.current.slideFrom === 'top' ? -8 : 0,
      x: contextMenuState.current.slideFrom === 'left' ? -8 : 0,
    }}
    out:fade={{ duration: 140 }}
    style={`left:${contextMenuState.current.x}px; top:${contextMenuState.current.y}px; width:${width}px; z-index:${contextMenuState.current.zIndex}; max-height:${MENU_MAX_HEIGHT}px;`}
    onscroll={e => {
      // Stop scroll events from bubbling up to prevent parent scroll handlers from closing the menu.
      e.stopPropagation()
    }}
  >
    {#if contextMenuState.current.items && contextMenuState.current.items.length}
      <ul bind:this={container}>
        <!-- Render each menu item as an accessible button so keyboard users can activate entries. -->
        {#each contextMenuState.current.items as it}
          {#if (it.children && it.children.length) || it.component}
            <!-- Recursive Submenu Item or Custom Component Flyout -->
            <ContextSubMenu
              item={it}
              parentZIndex={contextMenuState.current.zIndex}
              isOpen={activeItemId === it}
              onToggle={() => (activeItemId = activeItemId === it ? null : it)}
            />
          {:else}
            <li>
              <button
                role="menuitem"
                class:selected={it.isHighlighted}
                onclick={() => handleItemClick(it.action!)}
              >
                {#if it.icon}
                  {@const Icon = it.icon}
                  <Icon size={'1em'} strokeWidth={1} />
                {/if}
                {it.label}
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    {:else if contextMenuState.current.content}
      <div class="custom">{contextMenuState.current.content}</div>
    {/if}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    background: var(--c-white);
    border: 1px solid #88888863;
    border-radius: var(--rounded);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    /* z-index is set dynamically via inline style based on modal detection */
    /* Using fixed positioning so viewport coordinates from getBoundingClientRect() align correctly */
    /* max-height is set dynamically via inline style to enable scrolling when content exceeds limit */
    overflow-y: auto;
    overflow-x: hidden;
    user-select: none;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 220px;
  }

  li {
    list-style: none;
  }

  button[role='menuitem'] {
    background: none;
    border: none;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--c-black);
    cursor: pointer;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.5em;
    transition: all 0.2s ease;
    position: relative;
  }

  button.selected {
    color: var(--c-brand);
    font-weight: 500;
  }

  button:hover {
    background: var(--c-lightgrey);
    color: var(--c-brand);
    padding-left: 16px;
    font-weight: 500;
  }
  button[role='menuitem'] :global(svg) {
    transition: transform 0.2s ease;
  }

  .custom {
    padding: 10px 14px;
  }
</style>
