<script lang="ts">
  import Check from 'lucide-svelte/icons/check'
  import { highlightMenuItem, shouldCloseMenuOnAction } from './behavior'
  import { useContextMenu } from './contextMenuState.svelte'
  import {
    type MenuInteractiveItem,
    type MenuItem,
    isMenuDivider,
    isMenuFlyoutItem,
  } from './types'
  import ContextSubMenu from './ContextSubMenu.svelte'

  /**
   * One menu level's item list: dividers, flyout anchors, and action items.
   * Shared by the main menu and every submenu, so items render and behave
   * identically at every depth. Enter/Space need no handling here: the items
   * are native buttons, which activate on those keys by themselves.
   */
  interface Props {
    items: MenuItem[]
    /** z-index of the menu level hosting this list; flyouts open one above. */
    parentZIndex: number
    /** When set, value-bearing items render a leading radio/checkbox indicator. */
    selectionMode?: 'radio' | 'checkbox'
    /** The list element (the main menu binds it for arrow-key navigation). */
    list?: HTMLUListElement | null
  }

  let {
    items,
    parentZIndex,
    selectionMode = undefined,
    list = $bindable(null),
  }: Props = $props()

  const contextMenuState = useContextMenu()

  // Which flyout on this level is open.
  let activeItemLabel = $state<string | null>(null)

  // Reset when a new menu session opens, so a fresh menu doesn't inherit the
  // previous session's open flyout during the fade transition.
  $effect(() => {
    if (contextMenuState.current) {
      activeItemLabel = null
    }
  })

  const handleItemClick = (it: MenuInteractiveItem) => {
    if (it.disabled) return

    if (it.value !== undefined) {
      it.onAction?.(it.value)
    } else {
      it.onAction?.()
    }

    if (selectionMode === 'checkbox') {
      it.isHighlighted = !it.isHighlighted
    } else {
      highlightMenuItem(items, it.label)
    }

    if (shouldCloseMenuOnAction(it)) {
      contextMenuState.reset()
    }
  }
</script>

<ul bind:this={list}>
  {#each items as it}
    {#if isMenuDivider(it)}
      <li class="divider" role="presentation"></li>
    {:else if isMenuFlyoutItem(it)}
      <ContextSubMenu
        item={it}
        siblings={items}
        {parentZIndex}
        isOpen={activeItemLabel === it.label}
        onToggle={() =>
          (activeItemLabel =
            activeItemLabel === it.label ? null : (it.label ?? null))}
      />
    {:else}
      {@const showIndicator =
        selectionMode !== undefined && it.value !== undefined}
      <li class:has-secondary={!!it.secondaryAction}>
        <button
          role="menuitem"
          class:selected={it.isHighlighted}
          class:has-secondary={!!it.secondaryAction}
          disabled={it.disabled}
          onclick={e => {
            e.stopPropagation()
            handleItemClick(it)
          }}
        >
          {#if showIndicator}
            <span
              class={`indicator ${selectionMode}`}
              class:checked={it.isHighlighted}
            >
              {#if selectionMode === 'checkbox' && it.isHighlighted}
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
              contextMenuState.reset()
            }}
          >
            <SecIcon size={13} strokeWidth={1.5} />
          </button>
        {/if}
      </li>
    {/if}
  {/each}
</ul>

<style>
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
    transition: background var(--transition-fast) ease;
    border-radius: var(--rounded-md);
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
      background var(--transition-fast),
      border-color var(--transition-fast);
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
    border-radius: var(--rounded);
    padding: 4px;
    color: var(--c-darkgrey);
    cursor: pointer;
    transition:
      opacity var(--transition-fast) ease,
      background var(--transition-fast) ease,
      color var(--transition-fast) ease;
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
</style>
