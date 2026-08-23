<script lang="ts">
  import { useContextMenu } from './contextMenuState.svelte'
  import { MENU_MAX_HEIGHT, MENU_WIDTH } from './const'
  import { portal } from '$lib/shared/placement'
  import { scale } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import MenuList from './MenuList.svelte'

  const contextMenuState = useContextMenu()

  const onClose = () => contextMenuState.reset()

  let container: HTMLUListElement | null = $state(null)

  // Escape and arrow navigation only. Enter/Space need no handling: menu
  // items are native buttons, which activate on those keys by themselves.
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

  const focusNext = (delta: number) => {
    if (!container) return
    const buttons = Array.from(
      container.querySelectorAll('button[role="menuitem"]:not(:disabled)')
    ) as HTMLButtonElement[]
    if (buttons.length === 0) return
    const idx = buttons.findIndex(
      b => b === (document.activeElement as HTMLButtonElement)
    )
    const next =
      ((idx >= 0 ? idx : -1) + delta + buttons.length) % buttons.length
    buttons[next].focus()
  }

  $effect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
</script>

<!-- Stable Portal Host: Never unmounts, stays as a child of document.body -->
<div class="gp-context-menu-portal-root" use:portal>
  {#if contextMenuState.current}
    {@const menu = contextMenuState.current}
    <!-- Transition Unit: Contains main menu AND submenus, fades as one unit -->
    <div class="context-menu-transition-unit">
      <div
        class="menu"
        role="menu"
        style={`left:${menu.x}px; top:${menu.y}px; z-index:${menu.zIndex}; --menu-width: ${menu.width ?? MENU_WIDTH}px;`}
        in:scale={{ duration: 150, start: 0.96, easing: cubicOut }}
      >
        <div
          class="menu-content"
          onscroll={e => e.stopPropagation()}
          style={`max-height:${MENU_MAX_HEIGHT}px;`}
        >
          {#if menu.items && menu.items.length}
            <MenuList
              items={menu.items}
              parentZIndex={menu.zIndex}
              selectionMode={menu.selectionMode}
              bind:list={container}
            />
          {:else if menu.content}
            <div class="custom">{menu.content}</div>
          {/if}
        </div>
      </div>

      <!-- Submenus portal into this container, sharing the parent's fade -->
      <div id="gp-context-menu-portal-host"></div>
    </div>
  {/if}
</div>

<style>
  .gp-context-menu-portal-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 9999;
    pointer-events: none;
  }

  .context-menu-transition-unit {
    pointer-events: none;
  }

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

  .custom {
    padding: 8px 12px;
  }
</style>
