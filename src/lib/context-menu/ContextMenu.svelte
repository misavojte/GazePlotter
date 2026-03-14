<script lang="ts">
  import {
    highlightMenuItem,
    isMenuActionActivationKey,
    shouldCloseMenuOnAction,
  } from './behavior'
  import { contextMenuState } from './contextMenuState.svelte'
  import { MENU_MAX_HEIGHT, MENU_WIDTH } from './const'
  import {
    type ContextMenuState,
    type MenuInteractiveItem,
    type Point,
    type Position,
    isMenuDivider,
    isMenuFlyoutItem,
  } from './types'
  import { portal, getArrowStyle } from './utils'
  import ContextSubMenu from './ContextSubMenu.svelte'

  // State for which inner submenu is active.
  let activeItemLabel = $state<string | null>(null)

  // KISS Reset: When a NEW menu session opens, reset the local state.
  // This ensures a fresh experience (Fixes regressions) while allowing
  // the old state to remain stable during the 150ms fade-out transition.
  $effect(() => {
    if (contextMenuState.current) {
      activeItemLabel = null
    }
  })

  const onClose = () => contextMenuState.reset()

  let container: HTMLUListElement | null = $state(null)
  let menuElement: HTMLDivElement | null = $state(null)

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

{#snippet Arrow(position: Position, anchor: Point, menu: ContextMenuState)}
  <div
    class="menu-arrow"
    data-position={position}
    style={getArrowStyle(position, anchor, {
      ...menu,
      height: menuElement?.clientHeight,
    })}
  >
    <svg viewBox="0 0 16 8" width="16" height="8">
      <!-- A professional triangle with an open base and clean stroke -->
      <path
        d="M 0,8 L 8,0 L 16,8"
        fill="var(--c-white)"
        stroke="var(--menu-border-color)"
        stroke-width="1"
      />
    </svg>
  </div>
{/snippet}

<!-- Stable Portal Host: Never unmounts, stays as a child of document.body -->
<div class="gp-context-menu-portal-root" use:portal>
  {#if contextMenuState.current}
    {@const menu = contextMenuState.current}
    <!-- Transition Unit: Contains main menu AND submenus, fades as one unit -->
    <div class="context-menu-transition-unit">
      <div
        bind:this={menuElement}
        class="menu-wrapper"
        style={`left:${menu.x}px; top:${menu.y}px; z-index:${menu.zIndex}; --menu-width: ${MENU_WIDTH}px;`}
      >
        {#if menu.position && menu.anchorCenter}
          {@render Arrow(menu.position, menu.anchorCenter, menu)}
        {/if}

        <div class="menu" role="menu">
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

  /* But the transition unit should allow pointer events for the menu */
  .context-menu-transition-unit {
    pointer-events: none;
  }

  .menu-wrapper {
    position: fixed;
    /* Unified shadow that wraps both arrow and menu */
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

  .menu-arrow {
    position: absolute;
    width: 16px;
    height: 8px;
    z-index: 10;
  }

  .menu-arrow svg {
    display: block;
  }

  /* Correctly rotate and align the arrow based on position */
  .menu-arrow[data-position='top'] {
    transform: translateY(-1px); /* Slight overlap to merge borders */
  }
  .menu-arrow[data-position='top'] svg {
    transform: rotate(180deg);
  }

  .menu-arrow[data-position='bottom'] {
    transform: translateY(1px); /* Slight overlap to merge borders */
  }

  .menu-arrow[data-position='left'] {
    width: 8px;
    height: 16px;
    transform: translateX(-1px);
  }
  .menu-arrow[data-position='left'] svg {
    transform: rotate(90deg) translate(-4px, -4px);
    transform-origin: center;
  }

  .menu-arrow[data-position='right'] {
    width: 8px;
    height: 16px;
    transform: translateX(1px);
  }
  .menu-arrow[data-position='right'] svg {
    transform: rotate(-90deg) translate(4px, -4px);
    transform-origin: center;
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
    padding: 8px 12px;
    font-size: 13px;
    color: var(--c-text);
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
    background: var(--c-lightgrey);
    color: var(--c-black);
  }

  .custom {
    padding: 10px 12px;
  }
</style>
