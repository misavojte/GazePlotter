<script lang="ts">
  import { fly, fade } from 'svelte/transition'
  import {
    contextMenuState,
    updateContextMenu,
  } from './contextMenuState.svelte'
  import { MENU_MAX_HEIGHT } from './const'
  import type { MenuItem } from './types'
  import { portal } from './utils'
  import ContextSubMenu from './ContextSubMenu.svelte'

  const onClose = () => updateContextMenu(null)
  let width = 220
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
  }

  const focusNext = (delta: number) => {
    if (!container) return
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

  const handleItemClick = (it: MenuItem) => {
    if (it.onSelect) it.onSelect(it.value)
    if (it.action) it.action()

    if (state.items) {
      state.items.forEach(item => {
        item.isHighlighted = item.label === it.label
      })
    }

    const hasFlyout = (it.children && it.children.length) || it.component
    if (!hasFlyout && it.closeOnAction !== false) {
      onClose()
    }
  }

  let activeItemLabel = $state<string | null>(null)
  const state = $derived(contextMenuState.current!)

  const ARROW_WIDTH = 16
  const ARROW_HEIGHT = 8
  const ARROW_GUTTER = 12

  const getArrowStyle = (
    position: import('./types').Position | undefined,
    anchor: { x: number; y: number } | undefined
  ) => {
    if (!position || !anchor) return ''

    if (position === 'bottom' || position === 'top') {
      let left = anchor.x - state.x - ARROW_WIDTH / 2
      const min = ARROW_GUTTER
      const max = width - ARROW_GUTTER - ARROW_WIDTH
      left = Math.max(min, Math.min(left, max))
      const vertical = position === 'bottom' ? 'bottom: 100%' : 'top: 100%'
      return `left:${left}px; ${vertical};`
    } else {
      let top = anchor.y - state.y - ARROW_HEIGHT / 2
      const min = ARROW_GUTTER
      const max =
        (menuElement?.clientHeight ?? 200) - ARROW_GUTTER - ARROW_HEIGHT
      top = Math.max(min, Math.min(top, max))
      const horizontal = position === 'right' ? 'right: 100%' : 'left: 100%'
      return `${horizontal}; top:${top}px;`
    }
  }

  $effect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
</script>

{#snippet Arrow(position: string, anchor: { x: number; y: number })}
  <div
    class="menu-arrow"
    data-position={position}
    style={getArrowStyle(position as any, anchor)}
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

<div
  bind:this={menuElement}
  class="menu-wrapper"
  use:portal
  style={`left:${state.x}px; top:${state.y}px; z-index:${state.zIndex};`}
  in:fly={{
    duration: 150,
    y: state.slideFrom === 'top' ? -4 : state.slideFrom === 'bottom' ? 4 : 0,
    x: state.slideFrom === 'left' ? -4 : state.slideFrom === 'right' ? 4 : 0,
  }}
  out:fade={{ duration: 100 }}
>
  {#if state.position && state.anchorCenter}
    {@render Arrow(state.position, state.anchorCenter)}
  {/if}

  <div class="menu" role="menu">
    <div
      class="menu-content"
      onscroll={e => e.stopPropagation()}
      style={`max-height:${MENU_MAX_HEIGHT}px;`}
    >
      {#if state.items && state.items.length}
        <ul bind:this={container}>
          {#each state.items as it}
            {#if it.isDivider}
              <li class="divider" role="presentation"></li>
            {:else if (it.children && it.children.length) || it.component}
              <ContextSubMenu
                item={it}
                siblings={state.items}
                parentZIndex={state.zIndex}
                isOpen={activeItemLabel === it.label}
                onToggle={() =>
                  (activeItemLabel =
                    activeItemLabel === it.label ? null : it.label)}
              />
            {:else}
              <li>
                <button
                  role="menuitem"
                  class:selected={it.isHighlighted}
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
      {:else if state.content}
        <div class="custom">{state.content}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .menu-wrapper {
    position: fixed;
    /* Unified shadow that wraps both arrow and menu */
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
    pointer-events: none;
  }

  .menu {
    pointer-events: auto;
    background: var(--c-white);
    border: 1px solid var(--menu-border-color);
    border-radius: 8px;
    min-width: 220px;
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
    background: #e5e7eb;
    margin: 4px 0;
  }

  button[role='menuitem'] {
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

  .custom {
    padding: 10px 14px;
  }

  :global(.context-menu-anchor-active) {
    border-color: var(--menu-border-color) !important;
  }
</style>
