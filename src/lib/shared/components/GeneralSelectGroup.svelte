<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { contextMenuAction } from '$lib/context-menu'
  import {
    createGeneralSelectChangeEvent,
    createGeneralSelectMenuItems,
    getGeneralSelectLabel,
    type GroupSelectItem,
  } from './generalSelect'

  interface Props {
    items: GroupSelectItem[]
    ariaLabel: string
  }

  let { items, ariaLabel }: Props = $props()

  let groupIsOpen = $state<Record<number, boolean>>({})

  const getGroupMenuConfig = (index: number) => {
    const item = items[index]

    return {
      items: createGeneralSelectMenuItems(item.options, item.value, nextValue => {
        item.onchange?.(createGeneralSelectChangeEvent(nextValue))
      }),
      position: 'bottom' as const,
      horizontalAlign: 'start' as const,
      offset: 8,
      disabled: item.disabled ?? false,
      onOpen: () => {
        groupIsOpen = { [index]: true }
      },
      onClose: () => {
        groupIsOpen = { ...groupIsOpen, [index]: false }
        item.onClose?.()
      },
    }
  }
</script>

<div class="selectGroup" role="group" aria-label={ariaLabel}>
  {#each items as item, index}
    <div
      class="itemWrap"
      class:first={index === 0}
      class:last={index === items.length - 1}
    >
      <div
        class="select-wrapper compact"
        use:contextMenuAction={getGroupMenuConfig(index)}
      >
        <label for="group-select-trigger-{index}">{item.label}</label>
        <button
          id="group-select-trigger-{index}"
          class="trigger"
          class:open={groupIsOpen[index]}
          disabled={item.disabled}
          aria-expanded={groupIsOpen[index]}
          aria-haspopup="listbox"
        >
          <span class="trigger-content">
            <span class="label">{getGeneralSelectLabel(item.value, item.options)}</span>
            <div class="svg-wrap" class:open={groupIsOpen[index]}>
              <ChevronDown strokeWidth={1} />
            </div>
          </span>
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .select-wrapper {
    position: relative;
    width: 140px;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      sans-serif;
    --gp-field-bg: var(--c-white);
    user-select: none;
  }

  .select-wrapper.compact {
    display: flex;
    flex-direction: column;
    width: 140px;
    margin-bottom: 0;
    gap: 5px;
  }

  .select-wrapper.compact label {
    cursor: pointer;
  }

  .select-wrapper.compact:has(.trigger:disabled) label {
    cursor: not-allowed;
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
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .select-wrapper.compact:has(.trigger.open) label {
    color: var(--c-brand);
  }

  .select-wrapper.compact:not(:has(.trigger:disabled)):hover label {
    color: var(--c-brand);
  }

  .select-wrapper:not(:has(.trigger:disabled)):hover,
  .select-wrapper:has(.trigger.open) {
    --gp-field-bg: #f6f7f9;
  }

  .select-wrapper:has(.trigger:disabled) {
    --gp-field-bg: var(--c-lightgrey, #f5f5f5);
  }

  .trigger {
    background: var(--c-white);
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    height: 34px;
    padding: 0.25em 0.5em;
    padding-left: 14px;
    padding-right: 22px;
    font-size: 13px;
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

  .select-wrapper:not(:has(.trigger:disabled)):hover .trigger {
    background: #f6f7f9;
    color: var(--c-brand);
  }

  .trigger.open {
    background: #f6f7f9;
    color: var(--c-brand);
  }

  .trigger-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-width: 0;
  }

  .trigger-content > .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    transition:
      transform 0.2s ease,
      color 0.2s ease;
  }

  .select-wrapper:not(:has(.trigger:disabled)):hover .svg-wrap {
    color: var(--c-brand);
  }

  .trigger.open .svg-wrap {
    color: var(--c-brand);
  }

  .svg-wrap.open {
    transform: rotate(180deg);
  }

  .selectGroup {
    display: inline-flex;
    gap: 0;
    background: inherit;
    border-radius: var(--rounded-md);
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
    border-top-left-radius: var(--rounded-md);
    border-bottom-left-radius: var(--rounded-md);
  }

  .selectGroup .itemWrap.last .trigger {
    border-top-right-radius: var(--rounded-md);
    border-bottom-right-radius: var(--rounded-md);
  }

  * {
    box-sizing: border-box;
  }

  :focus {
    outline: none;
  }
</style>
