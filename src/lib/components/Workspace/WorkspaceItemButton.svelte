<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { melt, createTooltip } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'

  interface Props {
    label?: string;
    icon?: string;
    action?: string;
    tooltip?: string;
    disabled?: boolean;
    useAction?: boolean;
    actionParams?: any;
    actionFn?: any;
    children?: import('svelte').Snippet;
  }

  let {
    label = '',
    icon = '',
    action = '',
    tooltip = '',
    disabled = false,
    useAction = false,
    actionParams = {},
    actionFn = null,
    children
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    click: { action: string }
  }>()  

  function handleClick() {
    if (!disabled && !useAction) {
      dispatch('click', { action })
    }
  }

  // Create tooltip with proper configuration
  const {
    elements: {
      trigger: tooltipTrigger,
      content: tooltipContent,
      arrow: tooltipArrow,
    },
    states: { open: tooltipOpen },
  } = createTooltip({
    positioning: {
      placement: 'top',
      gutter: 5,
    },
    openDelay: 300,
    closeDelay: 100,
    disabled: disabled,
  })
</script>

<div class="tooltip-wrapper">
  {#if useAction && actionFn}
    <button
      class="workspace-item-button"
      class:disabled
      onclick={handleClick}
      aria-label={label || tooltip}
      use:melt={$tooltipTrigger}
      use:actionFn={actionParams}
    >
      {#if children}{@render children()}{:else}
        {#if icon}
          {@html icon}
        {/if}
        {#if label}
          <span class="label">{label}</span>
        {/if}
      {/if}
    </button>
  {:else}
    <button
      class="workspace-item-button"
      class:disabled
      onclick={handleClick}
      aria-label={label || tooltip}
      use:melt={$tooltipTrigger}
    >
      {#if children}{@render children()}{:else}
        {#if icon}
          {@html icon}
        {/if}
        {#if label}
          <span class="label">{label}</span>
        {/if}
      {/if}
    </button>
  {/if}

  {#if $tooltipOpen}
    <div
      class="tooltip"
      use:melt={$tooltipContent}
      transition:fade={{ duration: 150 }}
    >
      <div use:melt={$tooltipArrow} class="tooltip-arrow"></div>
      {tooltip || label}
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  .workspace-item-button {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px;
    border-radius: 4px;
    color: var(--c-darkgrey, #666);
    background: var(--c-grey);
    stroke: var(--c-darkgrey);
    stroke-width: 1px;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: var(--c-grey);
    transition: all 0.15s ease-out;
    border: none;
  }

  .workspace-item-button:hover {
    transform: scale(1.1);
    background: var(--c-darkgrey);
    color: var(--c-white);
  }

  .workspace-item-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .workspace-item-button.disabled:hover {
    transform: none;
    background: var(--c-grey);
    color: var(--c-darkgrey);
  }

  .label {
    margin-left: 4px;
  }

  .tooltip {
    z-index: 2500;
    background-color: var(--c-darkgrey);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    width: auto;
    height: auto;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    overflow: visible;
  }

  .tooltip-arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: var(--c-darkgrey);
    transform: rotate(45deg);
    bottom: -4px;
    pointer-events: none;
  }

  /* Global style to help with tooltip overflow */
  :global(.grid-item) {
    overflow: visible;
  }
</style>
