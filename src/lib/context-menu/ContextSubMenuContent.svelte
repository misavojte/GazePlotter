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
  class="menu submenu"
  role="menu"
  use:portal={'gp-context-menu-portal-host'}
  use:calculatePositionAction
  style={`left:${coords.x}px; top:${coords.y}px; z-index:${parentZIndex + 1}; --menu-width: ${menuWidth}px;`}
  in:fade={{ duration: 200 }}
>
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
                {#if child.detail}
                  <span class="item-body">
                    <span class="item-label">{child.label}</span>
                    <span class="item-detail">{child.detail}</span>
                  </span>
                {:else}
                  {child.label}
                {/if}
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .menu {
    position: fixed;
    pointer-events: auto;
    background: var(--c-white);
    border: var(--menu-border-width) solid var(--menu-border-color);
    border-radius: 8px;
    width: var(--menu-width, 220px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }

  .menu-content {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }

  li.divider {
    height: 1px;
    background: var(--c-grey);
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
    padding: 6px 12px;
    font-size: 13px;
    color: var(--c-text);
    cursor: pointer;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.1s ease;
    border-radius: 4px;
    margin: 0 4px;
    width: calc(100% - 8px);
  }

  button:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: -2px;
  }

  button:hover {
    background: var(--c-lightgrey);
    color: var(--c-black);
  }

  button.selected {
    background: color-mix(in srgb, var(--c-brand) 6%, var(--c-white));
    color: var(--c-brand);
    font-weight: 500;
  }

  button.selected:hover {
    background: color-mix(in srgb, var(--c-brand) 10%, var(--c-white));
  }

  .item-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .item-label {
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-detail {
    font-size: 10px;
    color: var(--c-darkgrey);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button.selected .item-detail {
    color: color-mix(in srgb, var(--c-brand) 70%, var(--c-darkgrey));
  }

  .custom-component-wrap {
    padding: 8px 12px;
  }
</style>
