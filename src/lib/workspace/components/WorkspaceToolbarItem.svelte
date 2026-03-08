<script lang="ts">
  import { tooltipAction } from '$lib/tooltip'
  import {
    contextMenuAction,
    type MenuItem,
    contextMenuState,
  } from '$lib/context-menu'

  /**
   * Action item interface for toolbar actions.
   */
  interface ActionItem {
    id: string
    label: string
  }

  /**
   * Props for the toolbar item component.
   */
  interface Props {
    id: string
    label: string
    icon: string
    actions: ActionItem[] // Array of actions
    onclick?: (event: { id: string; event: MouseEvent }) => void
    disabled?: boolean
  }

  let {
    id,
    label,
    icon,
    actions = [],
    onclick = () => {},
    disabled = false,
  }: Props = $props()

  let buttonElement: HTMLButtonElement | null = $state(null)
  let iconElement: HTMLDivElement | null = $state(null)

  /**
   * Convert action items to menu items format required by contextMenuAction.
   * Each menu item's action will fire the onclick callback with the action's id.
   *
   * @returns Array of MenuItem objects for the context menu.
   */
  const menuItems = $derived.by((): MenuItem[] => {
    return actions.map(action => ({
      label: action.label,
      action: () => {
        onclick({
          id: action.id,
          event: new MouseEvent('click'),
        })
      },
    }))
  })

  /**
   * Handle item click with animation.
   * For single actions, fires immediately. For multiple actions, the contextMenuAction handles showing the menu.
   *
   * @param event - Mouse click event from the button.
   */
  function handleClick(event: MouseEvent) {
    if (disabled) return

    // Add click animation to icon only.
    if (iconElement) {
      iconElement.style.transform = 'scale(0.85)'
      setTimeout(() => {
        if (iconElement) {
          iconElement.style.transform = 'scale(1)'
        }
      }, 100)
    }

    // If only one action, fire it immediately (contextMenuAction is disabled for single actions).
    if (actions.length === 1) {
      onclick({
        id: actions[0].id,
        event,
      })
      return
    }

    // If multiple actions, let the contextMenuAction handle showing the menu.
    // The action will prevent default and show the menu automatically.
  }

  /**
   * Check if context menu is currently visible for this component.
   * Used to disable tooltip when menu is open.
   */
  const isMenuVisible = $derived(contextMenuState.current !== null)
</script>

<div class="tooltip-wrapper">
  <button
    bind:this={buttonElement}
    class="toolbar-item"
    class:disabled
    onclick={handleClick}
    {disabled}
    use:tooltipAction={{
      content: label,
      position: 'right',
      disabled: isMenuVisible,
    }}
    use:contextMenuAction={{
      items: actions.length > 1 ? menuItems : undefined,
      position: 'right',
      horizontalAlign: 'start',
      offset: 8,
      slideFrom: 'left',
      disabled: disabled || actions.length <= 1,
    }}
  >
    <div class="toolbar-item-icon" bind:this={iconElement}>
      {@html icon}
    </div>
  </button>
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 4px;
    border-radius: 6px;
    color: var(--c-darkgrey, #666);
    background: transparent;
    border: none;
    stroke: var(--c-darkgrey);
    stroke-width: 1.5px;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    transition: all 0.15s ease-out;
  }

  .toolbar-item:hover:not(.disabled) {
    transform: scale(1.05);
    background-color: var(--c-midgrey, #e0e0e0);
    color: var(--c-black);
    stroke: var(--c-black);
  }

  .toolbar-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar-item-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s ease;
  }
</style>
