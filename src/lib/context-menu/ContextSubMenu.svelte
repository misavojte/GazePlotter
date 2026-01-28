<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { adjustPlacementForViewport, getMenuSize } from './utils'
  import { MENU_MAX_HEIGHT } from './const'
  import type { MenuItem } from './types'
  import {
    contextMenuState,
    updateContextMenu,
  } from './contextMenuState.svelte'
  import ContextSubMenu from './ContextSubMenu.svelte'
  import ContextSubMenuContent from './ContextSubMenuContent.svelte'

  interface Props {
    item: MenuItem
    siblings: MenuItem[] // New prop to handle highlight coordination
    parentZIndex: number
    isOpen: boolean
    onToggle: () => void
  }

  const { item, siblings, parentZIndex, isOpen, onToggle } = $props()

  let anchorElement: HTMLElement | null = $state(null)
  let coords = $state({ x: 0, y: 0 })
  let isFlippedX = $state(false)

  /**
   * Calculate position for the submenu relative to the anchor item
   */
  const calculatePositionAction = (node: HTMLElement) => {
    const update = () => {
      const rect = anchorElement?.getBoundingClientRect()
      if (!rect) return

      // Explicitly estimate size for custom components since getMenuSize won't see them as list items
      let menuSize = { width: 220, height: 0 }
      if (item.component) {
        const h = item.componentHeight ?? 120
        menuSize = { width: 220, height: h }
      } else {
        menuSize = getMenuSize(item.children, false)
      }

      // Initial preferred position: 4px overlap from the right of the anchor
      const initialX = rect.right - 4
      const initialY = rect.top - 2 // Slight vertical lift for better alignment

      const res = adjustPlacementForViewport(
        { x: initialX, y: initialY }, // Use preferred point with overlap
        menuSize,
        { width: window.innerWidth, height: window.innerHeight },
        rect,
        true
      )

      // If flipped, we want the +4 overlap from the left side of anchor.
      // The adjustPlacementForViewport uses rect.left - menuSize.width for flipped.
      // We adjust it here to ensure the 4px overlap.
      if (res.isFlippedX) {
        res.left = rect.left - menuSize.width + 4
      }

      isFlippedX = res.isFlippedX
      coords = { x: res.left, y: res.top }
    }

    update()
    return { update }
  }

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Always call selection handlers even if there is a submenu
    if (item.onSelect) item.onSelect(item.value)
    if (item.action) item.action()

    // Immediate visual feedback: Clear siblings and highlight self
    if (siblings) {
      siblings.forEach((s: MenuItem) => {
        s.isHighlighted = s.label === item.label
      })
    }

    onToggle()
  }
</script>

<li bind:this={anchorElement} class="submenu-wrapper">
  <button
    role="menuitem"
    aria-haspopup="true"
    aria-expanded={isOpen}
    class:active={isOpen}
    class:selected={item.isHighlighted}
    onclick={handleClick}
  >
    {#if item.icon}
      {@const Icon = item.icon}
      <Icon size={'1em'} strokeWidth={1} />
    {/if}
    <span class="label">{item.label}</span>
    <svg
      class="arrow"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  {#if isOpen && (item.children || item.component)}
    <ContextSubMenuContent
      {item}
      {coords}
      {isFlippedX}
      {parentZIndex}
      {calculatePositionAction}
    />
  {/if}
</li>

<style>
  .submenu-wrapper {
    position: relative;
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
    justify-content: space-between;
  }

  .label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .arrow {
    width: 12px;
    height: 12px;
    color: #9ca3af;
    opacity: 0.8;
    flex-shrink: 0;
  }

  button.selected {
    color: var(--c-brand);
    font-weight: 500;
  }

  button.active {
    background: #f3f4f6;
    color: var(--c-black);
  }

  button:hover {
    background: #f3f4f6;
    color: var(--c-black);
  }
</style>
