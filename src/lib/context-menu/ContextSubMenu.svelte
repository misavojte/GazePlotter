<script lang="ts">
  import { getMenuSize } from './layout'
  import { adjustForViewport } from '$lib/shared/placement'
  import { MENU_WIDTH, DEFAULT_COMPONENT_HEIGHT } from './const'
  import {
    type MenuFlyoutItem,
    type MenuItem,
    isMenuDivider,
  } from './types'
  import ContextSubMenuContent from './ContextSubMenuContent.svelte'

  interface Props {
    item: MenuFlyoutItem
    siblings: MenuItem[]
    parentZIndex: number
    isOpen: boolean
    onToggle: () => void
  }

  const { item, siblings, parentZIndex, isOpen, onToggle } = $props()

  let anchorElement: HTMLElement | null = $state(null)
  let coords = $state({ x: 0, y: 0 })

  /**
   * Calculate position for the submenu relative to the anchor item
   */
  const calculatePositionAction = (node: HTMLElement) => {
    const update = () => {
      const rect = anchorElement?.getBoundingClientRect()
      if (!rect) return

      // Explicitly estimate size for custom components since getMenuSize won't see them as list items
      let menuSize = { width: MENU_WIDTH, height: 0 }
      if (item.component) {
        const h = item.componentHeight ?? DEFAULT_COMPONENT_HEIGHT
        const w = item.componentWidth ?? MENU_WIDTH
        menuSize = { width: w, height: h }
      } else {
        menuSize = getMenuSize(item.children, false)
      }

      // Initial preferred position: 4px overlap from the right of the anchor
      const initialX = rect.right - 4
      const initialY = rect.top - 2 // Slight vertical lift for better alignment

      const res = adjustForViewport(
        { x: initialX, y: initialY }, // Use preferred point with overlap
        menuSize,
        { width: window.innerWidth, height: window.innerHeight },
        rect,
        true
      )

      // If flipped, we want the +4 overlap from the left side of anchor.
      // The adjustForViewport uses rect.left - menuSize.width for flipped.
      // We adjust it here to ensure the 4px overlap.
      if (res.isFlippedX) {
        res.left = rect.left - menuSize.width + 4
      }

      coords = { x: res.left, y: res.top }
    }

    update()
    return { update }
  }

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (item.disabled) return

    // Preserve current behavior: flyout anchors run their onAction before opening.
    if (item.value !== undefined) {
      item.onAction?.(item.value)
    } else {
      item.onAction?.()
    }

    // Immediate visual feedback: Clear siblings and highlight self
    if (siblings) {
      siblings.forEach((sibling: MenuItem): void => {
        if (!isMenuDivider(sibling)) {
          sibling.isHighlighted = sibling.label === item.label
        }
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
    disabled={item.disabled}
    onclick={handleClick}
  >
    {#if item.icon}
      {@const Icon = item.icon}
      <Icon size={'1em'} strokeWidth={1} />
    {/if}
    <span class="label">{item.label}</span>
    <svg
      class="arrow"
      width="14"
      height="14"
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
    justify-content: space-between;
  }

  button:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: -2px;
  }

  .label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .arrow {
    width: 14px;
    height: 14px;
    color: var(--c-darkgrey);
    flex-shrink: 0;
  }

  button.active {
    background: var(--c-lightgrey);
    color: var(--c-black);
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

  button.selected:hover,
  button.selected.active {
    background: color-mix(in srgb, var(--c-brand) 10%, var(--c-white));
    color: var(--c-brand);
  }
</style>
