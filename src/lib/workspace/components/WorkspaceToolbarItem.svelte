<script lang="ts">
  import type { LucideIconComponent } from '$lib/shared/types/iconComponent'
  import { tooltipAction } from '$lib/tooltip'
  import {
    contextMenuAction,
    type MenuItem,
    contextMenuState,
  } from '$lib/context-menu'

  interface ActionItem {
    label: string
    run: () => void
  }

  interface Props {
    label: string
    icon: LucideIconComponent
    actions: ActionItem[]
    disabled?: boolean
  }

  let { label, icon: Icon, actions = [], disabled = false }: Props = $props()

  let iconElement: HTMLDivElement | null = $state(null)

  const menuItems = $derived.by((): MenuItem[] => {
    return actions.map(action => ({
      label: action.label,
      action: action.run,
    }))
  })

  function handleClick() {
    if (disabled) return

    if (iconElement) {
      iconElement.style.transform = 'scale(0.85)'
      setTimeout(() => {
        if (iconElement) {
          iconElement.style.transform = 'scale(1)'
        }
      }, 100)
    }

    if (actions.length === 1) {
      actions[0].run()
      return
    }
  }

  const isMenuVisible = $derived(contextMenuState.current !== null)
</script>

<div class="tooltip-wrapper">
  <button
    class="toolbar-item"
    class:disabled
    onclick={handleClick}
    {disabled}
    aria-label={label}
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
      <Icon size={16} strokeWidth={1.75} />
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
