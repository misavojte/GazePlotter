<script lang="ts">
  import type { LucideIconComponent } from '$lib/shared/types'
  import { tooltipAction } from '$lib/tooltip'
  import {
    contextMenuAction,
    type MenuItem,
    contextMenuState,
  } from '$lib/context-menu'
  import { responsive } from '../responsive.svelte'

  interface ActionItem {
    label: string
    run?: () => void
    children?: ActionItem[]
  }

  interface Props {
    label: string
    icon: LucideIconComponent
    actions: ActionItem[]
    disabled?: boolean
    /**
     * When true, renders the `label` text inline beside the icon
     * instead of exposing it only through tooltip/aria. Used by the
     * rail's mobile plot-selected mode where the single Edit action
     * carries a readable label so there's no tooltip dependency.
     */
    showLabel?: boolean
  }

  let {
    label,
    icon: Icon,
    actions = [],
    disabled = false,
    showLabel = false,
  }: Props = $props()

  function toMenuItem(action: ActionItem): MenuItem {
    if (action.children && action.children.length > 0) {
      return { label: action.label, children: action.children.map(toMenuItem) }
    }
    return { label: action.label, onAction: action.run }
  }

  const menuItems = $derived.by((): MenuItem[] => actions.map(toMenuItem))

  // The item opens a menu when it has more than one entry, or a single entry
  // that is itself a submenu (e.g. only one plot group is available).
  const hasMenu = $derived(
    actions.length > 1 ||
      (actions.length === 1 && (actions[0].children?.length ?? 0) > 0)
  )

  // Press-feedback (icon scale-down) is pure CSS — see the
  // `.toolbar-item:active ... .toolbar-item-icon` rule below. The
  // button's `disabled` attribute suppresses clicks at the platform
  // level. `handleClick` only routes the single-action case here;
  // multi-action falls through to `contextMenuAction`.
  function handleClick() {
    if (disabled) return
    if (actions.length === 1 && actions[0].run && !actions[0].children?.length) {
      actions[0].run()
    }
  }

  const isMenuVisible = $derived(contextMenuState.current !== null)
</script>

<div class="tooltip-wrapper">
  <button
    class="toolbar-item"
    class:disabled
    class:with-label={showLabel}
    onclick={handleClick}
    {disabled}
    aria-label={label}
    use:tooltipAction={{
      content: label,
      position: responsive.isMobile ? 'top' : 'right',
      disabled: isMenuVisible || responsive.isMobile,
    }}
    use:contextMenuAction={{
      items: hasMenu ? menuItems : undefined,
      position: responsive.isMobile ? 'top' : 'right',
      horizontalAlign: responsive.isMobile ? 'center' : 'start',
      verticalAlign: responsive.isMobile ? 'end' : undefined,
      offset: 8,
      slideFrom: responsive.isMobile ? 'top' : 'left',
      disabled: disabled || !hasMenu,
    }}
  >
    <div class="toolbar-item-icon">
      <Icon size={16} strokeWidth={1.75} />
    </div>
    {#if showLabel}
      <span class="toolbar-item-label">{label}</span>
    {/if}
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
    border-radius: var(--rounded-md);
    color: var(--c-darkgrey);
    background: transparent;
    border: none;
    stroke: var(--c-darkgrey);
    stroke-width: 1.5px;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    transition: all var(--transition-fast) ease-out;
  }

  .toolbar-item:hover:not(.disabled) {
    transform: scale(1.05);
    background-color: var(--c-midgrey);
    color: var(--c-black);
    stroke: var(--c-black);
  }

  .toolbar-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Label variant: reuses the same toolbar-item base styles; just
     widens the button to fit an inline label beside the icon. No
     new color or shape tokens — the button keeps its existing
     transparent-background + darkgrey/black hover behavior. */
  .toolbar-item.with-label {
    width: auto;
    height: auto;
    padding: 6px 10px;
    gap: var(--spacing-xs);
  }

  .toolbar-item-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast) ease;
  }

  .toolbar-item:active:not(.disabled) .toolbar-item-icon {
    transform: scale(0.85);
  }

  .toolbar-item-label {
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }
</style>

