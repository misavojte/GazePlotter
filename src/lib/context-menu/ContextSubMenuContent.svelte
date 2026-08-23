<script lang="ts">
  import { scale } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { MENU_MAX_HEIGHT, MENU_WIDTH } from './const'
  import { type MenuFlyoutItem, isMenuComponentItem } from './types'
  import { useContextMenu } from './contextMenuState.svelte'
  import { portal } from '$lib/shared/placement'
  import MenuList from './MenuList.svelte'

  const contextMenuState = useContextMenu()

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
</script>

<div
  class="menu submenu"
  role="menu"
  use:portal={'gp-context-menu-portal-host'}
  use:calculatePositionAction
  style={`left:${coords.x}px; top:${coords.y}px; z-index:${parentZIndex + 1}; --menu-width: ${menuWidth}px;`}
  in:scale={{ duration: 150, start: 0.96, easing: cubicOut }}
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
      <MenuList items={item.children} parentZIndex={parentZIndex + 1} />
    {/if}
  </div>
</div>

<style>
  .menu {
    position: fixed;
    pointer-events: auto;
    background: var(--c-white);
    border: 1px solid color-mix(in srgb, var(--c-black) 8%, transparent);
    border-radius: 12px;
    --menu-width: 220px;
    width: var(--menu-width);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  .menu-content {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }

  .custom-component-wrap {
    padding: 8px 12px;
  }
</style>
