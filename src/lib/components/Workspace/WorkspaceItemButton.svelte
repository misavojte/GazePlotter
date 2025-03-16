<script lang="ts">
  import { onDestroy } from 'svelte'
  import { tooltipStore } from '$lib/stores/tooltipStore'

  interface Props {
    label?: string
    icon?: string
    action?: string
    tooltip?: string
    disabled?: boolean
    useAction?: boolean
    actionParams?: any
    actionFn?: any
    children?: import('svelte').Snippet
    onclick?: (event: CustomEvent) => void
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
    children,
    onclick = () => {},
  }: Props = $props()

  let buttonElement: HTMLElement

  function handleClick() {
    if (!disabled && !useAction) {
      onclick(new CustomEvent('click', { detail: { action } }))
    }
  }

  function showTooltip(event: MouseEvent) {
    if (disabled) return

    const rect = buttonElement.getBoundingClientRect()
    tooltipStore.set({
      visible: true,
      content: [{ key: '', value: tooltip || label }],
      x: rect.left,
      y: rect.top - 35 + window.scrollY,
      width: Math.max(100, (tooltip || label).length * 8),
    })
  }

  function hideTooltip() {
    tooltipStore.set(null)
  }

  onDestroy(() => {
    hideTooltip()
  })
</script>

<div class="tooltip-wrapper">
  {#if useAction && actionFn}
    <button
      class="workspace-item-button"
      class:disabled
      onclick={handleClick}
      aria-label={label || tooltip}
      bind:this={buttonElement}
      onmouseenter={showTooltip}
      onmouseleave={hideTooltip}
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
      bind:this={buttonElement}
      onmouseenter={showTooltip}
      onmouseleave={hideTooltip}
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

  /* Global style to help with tooltip overflow */
  :global(.grid-item) {
    overflow: visible;
  }
</style>
