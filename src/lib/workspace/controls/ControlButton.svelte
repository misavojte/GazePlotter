<script lang="ts">
  import type { LucideIconComponent } from '$lib/shared/icon'
  import { useTooltipAction } from '$lib/tooltip'
  import {
    useContextMenuAction,
    type MenuItem,
    useContextMenu,
  } from '$lib/context-menu'
  import type { ControlAction } from './config'

  const tooltipAction = useTooltipAction()
  const contextMenuAction = useContextMenuAction()
  const contextMenuState = useContextMenu()

  interface Props {
    label: string
    icon?: LucideIconComponent
    actions: ControlAction[]
    disabled?: boolean
    /** Which side tooltips and menus open on (away from the frame edge). */
    side?: 'left' | 'right' | 'top'
    /** Render the label as text beside the icon instead of a tooltip. */
    showLabel?: boolean
    /** Text in place of an icon (e.g. the zoom percentage). */
    text?: string
  }

  let {
    label,
    icon: Icon,
    actions = [],
    disabled = false,
    side = 'right',
    showLabel = false,
    text,
  }: Props = $props()

  function toMenuItem(action: ControlAction): MenuItem {
    if (action.children && action.children.length > 0) {
      return { label: action.label, children: action.children.map(toMenuItem) }
    }
    return { label: action.label, onAction: action.run }
  }

  const menuItems = $derived.by((): MenuItem[] => actions.map(toMenuItem))

  // Opens a menu for several entries, or one entry that is itself a submenu.
  const hasMenu = $derived(
    actions.length > 1 ||
      (actions.length === 1 && (actions[0].children?.length ?? 0) > 0)
  )

  function handleClick() {
    if (disabled) return
    if (actions.length === 1 && actions[0].run && !actions[0].children?.length) {
      actions[0].run()
    }
  }

  const isMenuVisible = $derived(contextMenuState.current !== null)
</script>

<button
  type="button"
  class="control"
  class:with-label={showLabel}
  class:with-text={text !== undefined}
  onclick={handleClick}
  {disabled}
  aria-label={label}
  use:tooltipAction={{
    content: label,
    position: side,
    disabled: isMenuVisible || showLabel,
  }}
  use:contextMenuAction={{
    items: hasMenu ? menuItems : undefined,
    position: side,
    horizontalAlign: side === 'top' ? 'center' : 'start',
    verticalAlign: side === 'top' ? 'end' : undefined,
    offset: 10,
    slideFrom: side === 'top' ? 'top' : 'left',
    disabled: disabled || !hasMenu,
  }}
>
  {#if text !== undefined}
    <span class="control-text">{text}</span>
  {:else if Icon}
    <Icon size={16} strokeWidth={1.75} />
  {/if}
  {#if showLabel}
    <span class="control-label">{label}</span>
  {/if}
</button>

<style>
  /* One square button of the workspace rail. */
  .control {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: var(--rounded-md);
    background: transparent;
    color: var(--c-darkgrey);
    cursor: pointer;
    transition:
      background-color var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }

  .control:hover:not(:disabled),
  .control:focus-visible {
    background-color: var(--c-lightgrey);
    color: var(--c-black);
  }

  .control:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: -2px;
  }

  .control:active:not(:disabled) {
    background-color: var(--c-midgrey);
  }

  .control:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control.with-label {
    width: auto;
    padding: 0 10px;
  }

  .control.with-text {
    height: 22px;
  }

  .control-label {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .control-text {
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
