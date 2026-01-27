<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { adjustPlacementForViewport, getMenuSize } from './utils'
  import { MENU_MAX_HEIGHT } from './const'
  import type { MenuItem } from './types'
  import { updateContextMenu } from './contextMenuState.svelte'
  import ContextSubMenu from './ContextSubMenu.svelte'

  interface Props {
    item: MenuItem
    parentZIndex: number
    isOpen: boolean
    onToggle: () => void
  }

  const { item, parentZIndex, isOpen, onToggle } = $props()

  let anchorElement: HTMLElement | null = $state(null)
  let coords = $state({ x: 0, y: 0 })
  let isFlippedX = $state(false)
  let activeChildId = $state<MenuItem | null>(null)

  $effect(() => {
    if (isOpen) {
      calculatePosition()
    }
  })

  /**
   * Calculate position for the submenu relative to the anchor item
   */
  const calculatePosition = () => {
    if (!anchorElement) return

    const rect = anchorElement.getBoundingClientRect()
    // Default position: to the right, top aligned

    // Explicitly estimate size for custom components since getMenuSize won't see them as list items
    let menuSize = { width: 220, height: 0 }
    if (item.component) {
      // Use configured composite height if available, else fallback to estimate
      const h = item.componentHeight ?? 120
      menuSize = { width: 220, height: h }
    } else {
      menuSize = getMenuSize(item.children, false)
    }

    const initialX = rect.right
    const initialY = rect.top - 4 // Slight offset to align nicely

    // Use viewport adjustment with flipping allowed for submenus
    const res = adjustPlacementForViewport(
      { left: initialX, top: initialY },
      menuSize,
      { width: window.innerWidth, height: window.innerHeight },
      rect,
      true
    )

    isFlippedX = res.isFlippedX
    coords = { x: res.left, y: res.top }
  }

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onToggle()
  }

  const handleChildAction = (fn: () => void) => {
    fn()
    updateContextMenu(null) // Close entire menu tree
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
    <span class="arrow">›</span>
  </button>

  {#if isOpen && (item.children || item.component)}
    <!-- Submenu Container -->
    <div
      class="menu submenu"
      role="menu"
      style={`left:${coords.x}px; top:${coords.y}px; z-index:${parentZIndex + 1}; max-height:${MENU_MAX_HEIGHT}px;`}
      in:fly={{ x: isFlippedX ? 8 : -8, duration: 140 }}
      out:fade={{ duration: 140 }}
    >
      {#if item.component}
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
            action={(data: any) => {
              if (item.action) item.action(data)
              updateContextMenu(null)
            }}
            close={() => updateContextMenu(null)}
          />
        </div>
      {:else if item.children}
        <ul>
          {#each item.children as child}
            {#if (child.children && child.children.length) || child.component}
              <!-- Recursive nesting -->
              <ContextSubMenu
                item={child}
                parentZIndex={parentZIndex + 1}
                isOpen={activeChildId === child}
                onToggle={() =>
                  (activeChildId = activeChildId === child ? null : child)}
              />
            {:else}
              <li>
                <button
                  role="menuitem"
                  class:selected={child.isHighlighted}
                  onclick={e => {
                    e.stopPropagation()
                    handleChildAction(child.action!)
                  }}
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
  {/if}
</li>

<style>
  .submenu-wrapper {
    position: relative;
  }

  .menu {
    position: fixed; /* Fixed to viewport like main menu */
    background: var(--c-white);
    border: 1px solid #88888863;
    border-radius: var(--rounded);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 220px;
    padding: 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  button {
    background: none;
    border: none;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--c-black);
    cursor: pointer;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.5em;
    transition: all 0.2s ease;
    justify-content: space-between; /* Space for arrow */
  }

  .label {
    flex: 1;
  }

  .arrow {
    font-size: 16px;
    line-height: 1;
    color: #999;
  }

  button.selected {
    color: var(--c-brand);
    font-weight: 500;
  }

  button.active,
  button:hover {
    background: var(--c-lightgrey);
    color: var(--c-brand);
    padding-left: 16px;
    font-weight: 500;
  }

  button:hover {
    background: var(--c-lightgrey);
    color: var(--c-brand);
  }
</style>
