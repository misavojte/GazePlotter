<script lang="ts">
  import {
    highlightMenuItem,
    isMenuActionActivationKey,
    shouldCloseMenuOnAction,
  } from './behavior'
  import { fade } from 'svelte/transition'
  import { MENU_MAX_HEIGHT, MENU_WIDTH } from './const'
  import {
    type MenuFlyoutItem,
    type MenuInteractiveItem,
    isMenuComponentItem,
    isMenuDivider,
    isMenuFlyoutItem,
  } from './types'


  import { contextMenuState } from './contextMenuState.svelte'
  import { portal } from './utils'
  import ContextSubMenu from './ContextSubMenu.svelte'

  interface PositionAction {
    update?: () => void
    destroy?: () => void
  }

  interface Props {
    item: MenuFlyoutItem
    coords: { x: number; y: number }
    parentZIndex: number
    calculatePositionAction: (node: HTMLElement) => PositionAction
  }

  const { item, coords, parentZIndex, calculatePositionAction }: Props =
    $props()

  const menuWidth = $derived(
    isMenuComponentItem(item) && item.componentWidth
      ? item.componentWidth
      : MENU_WIDTH
  )

  let activeChildLabel = $state<string | null>(null)

  const handleChildAction = (child: MenuInteractiveItem) => {
    if (child.disabled) return

    if (child.value !== undefined) {
      child.onAction?.(child.value)
    } else {
      child.onAction?.()
    }

    highlightMenuItem(item.children, child.label)

    if (shouldCloseMenuOnAction(child)) {
      contextMenuState.reset()
    }
  }

  const handleKeydown = (e: KeyboardEvent, child: MenuInteractiveItem) => {
    if (isMenuActionActivationKey(e.key)) {
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
  style={`left:${coords.x}px; top:${coords.y}px; z-index:${parentZIndex + 1}; --menu-width: ${menuWidth}px;`}
  in:fade={{ duration: 200 }}
>
  <div class="menu" role="menu">
    <div
      class="menu-content"
      onscroll={e => e.stopPropagation()}
      style={`max-height:${MENU_MAX_HEIGHT}px;`}
    >
      {#if isMenuComponentItem(item)}
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
            onAction={(data: unknown) => {
              if (typeof data === 'string' || data === undefined) {
                item.onAction?.(data)
              }
              contextMenuState.reset()
            }}
            close={() => contextMenuState.reset()}
          />
        </div>
      {:else if item.children}
        <ul>
          {#each item.children as child}
            {#if isMenuDivider(child)}
              <li class="divider" role="presentation"></li>
            {:else if isMenuFlyoutItem(child)}
              <ContextSubMenu
                item={child}
                siblings={item.children}
                parentZIndex={parentZIndex + 1}
                isOpen={activeChildLabel === child.label}
                onToggle={() =>
                  (activeChildLabel =
                    activeChildLabel === child.label
                      ? null
                      : (child.label ?? null))}
              />
            {:else}
              <li>
                <button
                  role="menuitem"
                  class:selected={child.isHighlighted}
                  disabled={child.disabled}
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
