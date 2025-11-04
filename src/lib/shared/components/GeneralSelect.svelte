<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { contextMenuAction, type MenuItem } from '$lib/context-menu'

  interface Props {
    options: readonly { value: string; label: string }[]
    disabled?: boolean
    label: string
    value?: string
    compact?: boolean
    onchange?: (event: CustomEvent) => void
    // Group mode props (optional, mirrors GeneralButtonMinor grouping)
    items?: GroupSelectItem[]
    ariaLabel?: string
  }

  export interface GroupSelectItem {
    options: readonly { value: string; label: string }[]
    label: string
    value: string
    disabled?: boolean
    ariaLabel?: string
    onchange?: (event: CustomEvent) => void
  }

  let {
    options,
    disabled = false,
    label,
    value = $bindable(options[0]?.value || ''),
    compact = false,
    onchange = () => {},
    // group
    items,
    ariaLabel,
  }: Props = $props()

  // Group helpers
  const itemsSafe = $derived((items ?? []) as GroupSelectItem[])
  const isGroup = $derived(itemsSafe.length > 0)

  // Single select state
  let singleTriggerEl: HTMLButtonElement | null = $state(null)
  let singleIsOpen = $state(false)

  /**
   * Convert options array to MenuItem format for the context menu.
   *
   * @param optionList - Array of option objects with value and label.
   * @returns Array of MenuItem objects suitable for context menu action.
   */
  const optionsToMenuItems = (optionList: readonly { value: string; label: string }[]): MenuItem[] => {
    return optionList.map((option) => ({
      label: option.label,
      action: () => {
        value = option.value
        onchange(new CustomEvent('change', { detail: option.value }))
      },
      isHighlighted: option.value === value,
    }))
  }

  const singleMenuItems = $derived(optionsToMenuItems(options))

  const singleMenuConfig = $derived({
    items: singleMenuItems,
    position: 'bottom' as const,
    horizontalAlign: 'start' as const,
    offset: 8,
    disabled,
    onOpen: () => {
      singleIsOpen = true
    },
    onClose: () => {
      singleIsOpen = false
    },
  })

  // Group select state
  let groupIsOpen = $state<boolean[]>([])

  $effect(() => {
    groupIsOpen = itemsSafe.map(() => false)
  })

  /**
   * Convert a group item's options to MenuItem format for the context menu.
   *
   * @param idx - Index of the group item.
   * @returns Array of MenuItem objects for this group item's options.
   */
  const groupItemToMenuItems = (idx: number): MenuItem[] => {
    const item = itemsSafe[idx]
    return item.options.map((option) => ({
      label: option.label,
      action: () => {
        item.onchange?.(new CustomEvent('change', { detail: option.value }))
      },
      isHighlighted: option.value === item.value,
    }))
  }

  /**
   * Get the context menu configuration for a specific group item.
   *
   * @param idx - Index of the group item.
   * @returns Context menu options for this group item.
   */
  const getGroupMenuConfig = (idx: number) => ({
    items: groupItemToMenuItems(idx),
    position: 'bottom' as const,
    horizontalAlign: 'start' as const,
    offset: 8,
    disabled: itemsSafe[idx]?.disabled ?? false,
    onOpen: () => {
      // Close all other selects in the group before opening this one.
      groupIsOpen = groupIsOpen.map((isOpen, i) => i === idx)
    },
    onClose: () => {
      groupIsOpen[idx] = false
    },
  })

  // Helper functions
  const getCurrentLabel = (currentValue: string, optionList: readonly { value: string; label: string }[]) => {
    return optionList.find(opt => opt.value === currentValue)?.label || optionList[0]?.label || ''
  }

  let componentElement: HTMLDivElement | null = $state(null)
</script>

<div class="general-select-container" bind:this={componentElement}>
  {#if !isGroup}
    <!-- Single select mode -->
    <div class="select-wrapper" class:compact>
      <label for="single-select-trigger">{label}</label>
      <button
        id="single-select-trigger"
        class="trigger"
        class:disabled
        class:open={singleIsOpen}
        bind:this={singleTriggerEl}
        use:contextMenuAction={singleMenuConfig}
        aria-expanded={singleIsOpen}
        aria-haspopup="listbox"
      >
        <span class="trigger-content">
          <span class="label">{getCurrentLabel(value, options)}</span>
          <div class="svg-wrap" class:open={singleIsOpen}>
            <ChevronDown strokeWidth={1} />
          </div>
        </span>
      </button>
    </div>
  {:else}
    <!-- Group mode: always compact -->
    <div class="selectGroup" role="group" aria-label={ariaLabel}>
      {#each itemsSafe as item, idx}
        <div class="itemWrap" class:first={idx === 0} class:last={idx === itemsSafe.length - 1}>
          <div class="select-wrapper compact">
            <label for="group-select-trigger-{idx}">{item.label}</label>
            <button
              id="group-select-trigger-{idx}"
              class="trigger"
              class:disabled={item.disabled}
              class:open={groupIsOpen[idx]}
              use:contextMenuAction={getGroupMenuConfig(idx)}
              aria-expanded={groupIsOpen[idx]}
              aria-haspopup="listbox"
            >
              <span class="trigger-content">
                <span class="label">{getCurrentLabel(item.value, item.options)}</span>
                <div class="svg-wrap" class:open={groupIsOpen[idx]}>
                  <ChevronDown strokeWidth={1} />
                </div>
              </span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .select-wrapper {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 170px;
    margin-bottom: 15px;
    gap: 5px;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      sans-serif;
    /* Track field background for syncing with compact label */
    --gp-field-bg: var(--c-white);
    /* Fixed menu width to prevent item reflow/jump on hover */
    --gp-menu-width: 18rem;
  }

  .select-wrapper.compact {
    width: 140px;
    margin-bottom: 0;
  }

  label {
    font-size: 14px;
    color: var(--c-black);
  }

  .compact label {
    font-size: 8px;
    position: absolute;
    font-weight: 500;
    line-height: 1rem;
    letter-spacing: 0.0333333333em;
    text-transform: uppercase;
    color: var(--c-darkgrey);
    background: var(--gp-field-bg);
    border-radius: 8px;
    padding-inline: 6px;
    left: 10px;
    top: -0.9em;
    z-index: 2;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  /* In open state, compact label text should be red (brand) */
  .select-wrapper.compact:has(.trigger.open) label {
    color: var(--c-brand);
  }

  /* In hover state, compact label text should also be red, with same transition */
  .select-wrapper.compact:has(.trigger:not(.disabled):hover) label {
    color: var(--c-brand);
  }

  /* Sync wrapper bg var with hover/open/disabled states */
  .select-wrapper:has(.trigger:not(.disabled):hover),
  .select-wrapper:has(.trigger.open) {
    --gp-field-bg: #f6f7f9;
  }
  .select-wrapper:has(.trigger:disabled) {
    --gp-field-bg: var(--c-lightgrey, #f5f5f5);
  }

  .trigger {
    background: var(--c-white);
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    height: 34px;
    padding: 0.25em 0.5em;
    padding-right: 22px;
    font-size: 14px;
    color: var(--c-black);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    transition: all 0.2s ease;
    font-weight: 400;
    line-height: 1.5rem;
    letter-spacing: 0.00938em;
    width: 100%;
    box-sizing: border-box;
  }

  .trigger:disabled {
    border-color: var(--c-grey);
    background-color: var(--c-lightgrey, #f5f5f5);
    color: var(--c-darkgrey);
    cursor: not-allowed;
  }

  .trigger:not(.disabled):hover {
    background: #f6f7f9;
    color: var(--c-brand);
  }

  /* Keep hovered styling when menu is open */
  .trigger.open {
    background: #f6f7f9;
    color: var(--c-brand);
  }

  .trigger:not(.disabled):focus-visible {
    outline: 2px solid var(--c-primary, #1976d2);
    outline-offset: 2px;
  }

  .trigger-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-width: 0; /* allow ellipsis */
  }

  .trigger-content > .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact .trigger {
    padding-left: 14px;
    padding-right: 22px;
  }

  .svg-wrap {
    position: absolute;
    right: 3px;
    top: 0;
    height: 100%;
    width: 15px;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-darkgrey);
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .trigger:not(.disabled):hover .svg-wrap,
  .trigger:not(.disabled):focus-visible .svg-wrap {
    color: var(--c-brand);
  }

  .trigger.open .svg-wrap {
    color: var(--c-brand);
  }

  .svg-wrap.open {
    transform: rotate(180deg);
  }

  /* Menu styling is now handled by the context menu component */

  /* Group wrapper and separators (mirrors button group behavior) */
  .selectGroup {
    display: inline-flex;
    gap: 0;
    background: inherit;
    border-radius: var(--rounded);
  }

  .itemWrap {
    position: relative;
  }

  .selectGroup .itemWrap:not(.first)::before {
    content: '';
    position: absolute;
    left: 0;
    top: 1px;
    bottom: 1px;
    width: 1px;
    background: var(--c-midgrey);
    opacity: 0.7;
    pointer-events: none;
    z-index: 2;
  }

  /* Remove inner borders and radius so adjacent selects appear merged */
  .selectGroup .itemWrap:not(.first) .trigger {
    border-left: none;
  }

  .selectGroup .itemWrap:not(.last) .trigger {
    border-right: none;
  }

  .selectGroup .itemWrap .trigger {
    border-radius: 0;
  }

  .selectGroup .itemWrap.first .trigger {
    border-top-left-radius: var(--rounded);
    border-bottom-left-radius: var(--rounded);
  }

  .selectGroup .itemWrap.last .trigger {
    border-top-right-radius: var(--rounded);
    border-bottom-right-radius: var(--rounded);
  }

  /* Add these consistent styles to all components */
  * {
    box-sizing: border-box;
  }

  :focus {
    outline: none;
  }
</style>

<!--
Usage examples:

<GeneralSelect label="Mode" options={[{ value: 'a', label: 'A' }]} />

<GeneralSelect
  ariaLabel="Filters"
  items=[
    { label: 'A', options: aOpts, value: aVal, onchange: e => aVal = e.detail },
    { label: 'B', options: bOpts, value: bVal, onchange: e => bVal = e.detail }
  ]
/>
-->
