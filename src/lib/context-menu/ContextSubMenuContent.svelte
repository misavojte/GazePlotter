<script lang="ts">
  import { fade } from 'svelte/transition'
  import { MENU_MAX_HEIGHT, MENU_WIDTH } from './const'
  import type { MenuItem } from './types'
  import { contextMenuState } from './contextMenuState.svelte'
  import { portal } from './utils'
  import ContextSubMenu from './ContextSubMenu.svelte'

  interface Props {
    item: MenuItem
    coords: { x: number; y: number }
    parentZIndex: number
    calculatePositionAction: (node: HTMLElement) => any
  }

  const { item, coords, parentZIndex, calculatePositionAction } = $props()

  let activeChildLabel = $state<string | null>(null)

  const handleChildAction = (child: MenuItem) => {
    if (child.onSelect) child.onSelect(child.value)
    if (child.action) child.action()

    if (item.children) {
      item.children.forEach((c: MenuItem) => {
        c.isHighlighted = c.label === child.label
      })
    }

    if (child.closeOnAction !== false) {
      contextMenuState.reset()
    }
  }

  const handleKeydown = (e: KeyboardEvent, child: MenuItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      handleChildAction(child)
    }
  }
</script>

<div
  class="menu-wrapper submenu"
  use:portal={'gp-context-menu-portal-host'}
  use:calculatePositionAction
  style={`left:${coords.x}px; top:${coords.y}px; z-index:${parentZIndex + 1}; --menu-width: ${MENU_WIDTH}px;`}
  in:fade={{ duration: 200 }}
>
  <div class="menu" role="menu">
    <div
      class="menu-content"
      onscroll={e => e.stopPropagation()}
      style={`max-height:${MENU_MAX_HEIGHT}px;`}
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
              contextMenuState.reset()
            }}
            close={() => contextMenuState.reset()}
          />
        </div>
      {:else if item.children}
        <ul>
          {#each item.children as child}
            {#if child.isDivider}
              <li class="divider" role="presentation"></li>
            {:else if (child.children && child.children.length) || child.component}
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
                  onkeydown={e => handleKeydown(e, child)}
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
  </div>
</div>

<style>
  .menu-wrapper {
    position: fixed;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
    pointer-events: none;
  }

  .menu {
    pointer-events: auto;
    background: var(--c-white);
    border: var(--menu-border-width) solid var(--menu-border-color);
    border-radius: 8px;
    width: var(--menu-width, 220px);
    overflow: hidden;
  }

  .menu-content {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }

  li.divider {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  button {
    background: none;
    border: none;
    padding: 8px 12px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.1s ease;
    border-radius: 4px;
    margin: 0 4px;
    width: calc(100% - 8px);
  }

  button.selected {
    color: var(--c-brand);
    font-weight: 500;
  }

  button:hover {
    background: #f3f4f6;
    color: var(--c-black);
  }

  .custom-component-wrap {
    padding: 10px 12px;
  }
</style>
