<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { MENU_MAX_HEIGHT } from './const'
  import type { MenuItem } from './types'
  import { updateContextMenu } from './contextMenuState.svelte'
  import ContextSubMenu from './ContextSubMenu.svelte'

  interface Props {
    item: MenuItem
    coords: { x: number; y: number }
    isFlippedX: boolean
    parentZIndex: number
    calculatePositionAction: (node: HTMLElement) => any
  }

  const { item, coords, isFlippedX, parentZIndex, calculatePositionAction } =
    $props()

  // --- LOCAL STATE ---
  // This state is destroyed when the component unmounts (isOpen = false in parent)
  let activeChildLabel = $state<string | null>(null)

  const handleChildAction = (child: MenuItem) => {
    if (child.onSelect) child.onSelect(child.value)
    if (child.action) child.action()

    // Immediate visual feedback: Update highlights for siblings in this submenu
    if (item.children) {
      item.children.forEach(c => {
        c.isHighlighted = c.label === child.label
      })
    }

    // Close only if it's not explicitly persistent
    if (child.closeOnAction !== false) {
      updateContextMenu(null) // Close entire menu tree
    }
  }
</script>

<div
  class="menu submenu"
  role="menu"
  use:calculatePositionAction
  style={`left:${coords.x}px; top:${coords.y}px; z-index:${parentZIndex + 1}; max-height:${MENU_MAX_HEIGHT}px;`}
  in:fly={{ x: isFlippedX ? 8 : -8, duration: 140 }}
  out:fade={{ duration: 140 }}
>
  {#if item.component}
    {@const CustomComponent = item.component}
    <div
      class="custom-component-wrap"
      onclick={e => e.stopPropagation()}
      onkeydown={e => e.stopPropagation()}
      role="presentation"
    >
      <CustomComponent
        {item}
        {...item.componentProps}
        action={(data: any) => {
          if (item.action) item.action(data)
          updateContextMenu(null)
        }}
        close={() => updateContextMenu(null)}
      />
    </div>
  {:else if item.children}
    <ul>
      {#each item.children as child}
        {#if child.isDivider}
          <li class="divider" role="presentation"></li>
        {:else if (child.children && child.children.length) || child.component}
          <!-- Recursive nesting -->
          <ContextSubMenu
            item={child}
            siblings={item.children}
            parentZIndex={parentZIndex + 1}
            isOpen={activeChildLabel === child.label}
            onToggle={() =>
              (activeChildLabel =
                activeChildLabel === child.label ? null : child.label)}
          />
        {:else}
          <li>
            <button
              role="menuitem"
              class:selected={child.isHighlighted}
              onclick={e => {
                e.stopPropagation()
                handleChildAction(child)
              }}
            >
              {#if child.icon}
                {@const ChildIcon = child.icon}
                <ChildIcon size={'1em'} strokeWidth={1} />
              {/if}
              {child.label}
            </button>
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .menu {
    position: fixed;
    background: var(--c-white);
    border: 1px solid #88888863;
    border-radius: var(--rounded);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 220px;
    padding: 0;
  }

  li.divider {
    height: 1px;
    background: #88888844;
    margin: 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  button {
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
</style>
