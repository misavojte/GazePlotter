<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { untrack } from 'svelte'
  import { contextMenuAction } from '$lib/context-menu'
  import GeneralInputScaffold from '$lib/shared/components/GeneralInputScaffold.svelte'
  import {
    createGeneralSelectChangeEvent,
    createGeneralSelectMenuItems,
    getGeneralSelectLabel,
    type GeneralSelectOption,
  } from './generalSelect'

  interface Props {
    options?: readonly GeneralSelectOption[]
    disabled?: boolean
    label: string
    value?: string
    compact?: boolean
    onchange?: (event: CustomEvent<string>) => void
    onClose?: () => void
  }

  let {
    options = [],
    disabled = false,
    label,
    value = $bindable(options[0]?.value ?? ''),
    compact = false,
    onchange = () => {},
    onClose = () => {},
  }: Props = $props()

  let isOpen = $state(false)

  const triggerId = `select-${untrack(() =>
    label.toLowerCase().replace(/\s+/g, '-')
  )}`

  const menuItems = $derived(
    createGeneralSelectMenuItems(options, value, nextValue => {
      value = nextValue
      onchange(createGeneralSelectChangeEvent(nextValue))
    })
  )

  const menuConfig = $derived({
    items: menuItems,
    position: 'bottom' as const,
    horizontalAlign: 'start' as const,
    offset: 8,
    disabled,
    onOpen: () => {
      isOpen = true
    },
    onClose: () => {
      isOpen = false
      onClose()
    },
  })
</script>

<GeneralInputScaffold label={label} id={triggerId} {compact}>
  <div class="select-wrapper" class:compact use:contextMenuAction={menuConfig}>
    <button
      id={triggerId}
      class="trigger"
      class:disabled
      class:open={isOpen}
      {disabled}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    >
      <span class="trigger-content">
        <span class="label">{getGeneralSelectLabel(value, options)}</span>
        <div class="svg-wrap" class:open={isOpen}>
          <ChevronDown strokeWidth={1} />
        </div>
      </span>
    </button>
  </div>
</GeneralInputScaffold>

<style>
  .select-wrapper {
    position: relative;
    width: 170px;
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

  .trigger:not(.disabled):focus-visible {
    outline: 2px solid var(--c-primary, #1976d2);
    outline-offset: 2px;
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
    transition:
      transform 0.2s ease,
      color 0.2s ease;
  }

  .select-wrapper:not(:has(.trigger:disabled)):hover .svg-wrap,
  .trigger:not(.disabled):focus-visible .svg-wrap {
    color: var(--c-brand);
  }

  .trigger.open .svg-wrap {
    color: var(--c-brand);
  }

  .svg-wrap.open {
    transform: rotate(180deg);
  }

  * {
    box-sizing: border-box;
  }

  :focus {
    outline: none;
  }
</style>
