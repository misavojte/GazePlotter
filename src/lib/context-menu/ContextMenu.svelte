<script lang="ts">
  import {
    highlightMenuItem,
    isMenuActionActivationKey,
    shouldCloseMenuOnAction,
  } from './behavior'
  import Check from 'lucide-svelte/icons/check'
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

    if (menu.selectionMode === 'checkbox') {
      it.isHighlighted = !it.isHighlighted
    } else {
      highlightMenuItem(menu.items, it.label)
    }

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
        style={`left:${menu.x}px; top:${menu.y}px; z-index:${menu.zIndex}; --menu-width: ${menu.width ?? MENU_WIDTH}px;`}
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
                  {@const showIndicator =
                    menu.selectionMode !== undefined && it.value !== undefined}
                  <li class:has-secondary={!!it.secondaryAction}>
                    <button
                      role="menuitem"
                      class:selected={it.isHighlighted}
                      class:has-secondary={!!it.secondaryAction}
                      disabled={it.disabled}
                      onclick={() => handleItemClick(it)}
                    >
                      {#if showIndicator}
                        <span class={`indicator ${menu.selectionMode}`} class:checked={it.isHighlighted}>
                          {#if menu.selectionMode === 'checkbox' && it.isHighlighted}
                            <Check size={10} strokeWidth={2.5} />
                          {/if}
                        </span>
                      {:else if it.icon}
                        {@const Icon = it.icon}
                        <Icon size={'1em'} strokeWidth={1} />
                      {/if}
                      {#if it.detail}
                        <span class="item-body">
                          <span class="item-label">{it.label}</span>
                          <span class="item-detail">{it.detail}</span>
                        </span>
                      {:else}
                        {it.label}
                      {/if}
                    </button>
                    {#if it.secondaryAction}
                      {@const SecIcon = it.secondaryAction.icon}
                      <button
                        type="button"
                        class="secondary-action"
                        aria-label={it.secondaryAction.label}
                        title={it.secondaryAction.label}
                        onclick={ev => {
                          ev.stopPropagation()
                          it.secondaryAction!.onAction()
                          onClose()
                        }}
                      >
                        <SecIcon size={13} strokeWidth={1.5} />
                      </button>
                    {/if}
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
  }

  button.selected:hover {
    background: color-mix(in srgb, var(--c-brand) 10%, var(--c-white));
  }

  button.selected:not(:has(.indicator)) {
    color: var(--c-brand);
    font-weight: 500;
  }

  .indicator {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--c-midgrey);
    transition:
      background 0.1s,
      border-color 0.1s;
  }

  .indicator.radio {
    border-radius: 50%;
    position: relative;
  }

  .indicator.radio.checked {
    border-color: var(--c-brand);
  }

  .indicator.radio.checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--c-brand);
  }

  .indicator.checkbox {
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-white);
    background: var(--c-white);
  }

  .indicator.checkbox.checked {
    background: var(--c-brand);
    border-color: var(--c-brand);
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

  li.has-secondary {
    position: relative;
  }

  button[role='menuitem'].has-secondary {
    padding-right: 32px;
  }

  .secondary-action {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    pointer-events: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 4px;
    color: var(--c-darkgrey);
    cursor: pointer;
    transition:
      opacity 0.1s ease,
      background 0.1s ease,
      color 0.1s ease;
  }

  li.has-secondary:hover .secondary-action,
  li.has-secondary:focus-within .secondary-action {
    opacity: 1;
    pointer-events: auto;
  }

  .secondary-action:hover {
    background: var(--c-grey);
    color: var(--c-brand);
  }

  .secondary-action:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: -2px;
    opacity: 1;
    pointer-events: auto;
  }

  .custom {
    padding: 8px 12px;
  }
</style>
