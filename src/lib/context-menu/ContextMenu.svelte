<script lang="ts">
  import {
    highlightMenuItem,
    isMenuActionActivationKey,
    shouldCloseMenuOnAction,
  } from './behavior'
  import { contextMenuState } from './contextMenuState.svelte'
  import { MENU_MAX_HEIGHT, MENU_WIDTH } from './const'
  import {
    type MenuInteractiveItem,
    isMenuDivider,
    isMenuFlyoutItem,
  } from './types'
  import { portal } from './utils'
  import ContextSubMenu from './ContextSubMenu.svelte'

  // State for which inner submenu is active.
  let activeItemLabel = $state<string | null>(null)

  // Reset local state when a new menu session opens, so a fresh menu doesn't
  // inherit the previous session's open submenu during the fade transition.
  $effect(() => {
    if (contextMenuState.current) {
      activeItemLabel = null
    }
  })

  const onClose = () => contextMenuState.reset()

  let container: HTMLUListElement | null = $state(null)

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
    if (isMenuActionActivationKey(ev.key)) {
      const active = document.activeElement as HTMLButtonElement
      if (active && active.role === 'menuitem' && container?.contains(active)) {
        ev.preventDefault()
        active.click()
      }
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

  const handleItemClick = (it: MenuInteractiveItem) => {
    const menu = contextMenuState.current
    if (!menu) return
    if (it.disabled) return

    if (it.value !== undefined) {
      it.onAction?.(it.value)
    } else {
      it.onAction?.()
    }

    highlightMenuItem(menu.items, it.label)

    if (shouldCloseMenuOnAction(it)) {
      onClose()
    }
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
        style={`left:${menu.x}px; top:${menu.y}px; z-index:${menu.zIndex}; --menu-width: ${MENU_WIDTH}px;`}
      >
        <div
          class="menu-content"
          onscroll={e => e.stopPropagation()}
          style={`max-height:${MENU_MAX_HEIGHT}px;`}
        >
          {#if menu.items && menu.items.length}
            <ul bind:this={container}>
              {#each menu.items as it}
                {#if isMenuDivider(it)}
                  <li class="divider" role="presentation"></li>
                {:else if isMenuFlyoutItem(it)}
                  <ContextSubMenu
                    item={it}
                    siblings={menu.items}
                    parentZIndex={menu.zIndex}
                    isOpen={activeItemLabel === it.label}
                    onToggle={() =>
                      (activeItemLabel =
                        activeItemLabel === it.label
                          ? null
                          : (it.label ?? null))}
                  />
                {:else}
                  <li>
                    <button
                      role="menuitem"
                      class:selected={it.isHighlighted}
                      disabled={it.disabled}
                      onclick={() => handleItemClick(it)}
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

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li.divider {
    height: 1px;
    background: var(--c-grey);
    margin: 4px 0;
  }

  button[role='menuitem'] {
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

  button[role='menuitem']:focus-visible {
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
    color: var(--c-brand);
  }

  .custom {
    padding: 8px 12px;
  }
</style>
