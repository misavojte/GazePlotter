<script lang="ts">
  import type { MoveHandleActionParams } from './interaction/moveHandleAction'
  import { tooltipAction } from '$lib/tooltip'

  interface Props {
    label?: string
    icon?: string
    action?: string
    tooltip?: string
    disabled?: boolean
    useAction?: boolean
    actionParams?: MoveHandleActionParams
    actionFn?: typeof import('./interaction/moveHandleAction').moveHandleAction
    class?: string
    children?: import('svelte').Snippet
    onclick?: (event: CustomEvent<{ action: string }>) => void
  }

  let {
    label = '',
    icon = '',
    action = '',
    tooltip = '',
    disabled = false,
    useAction = false,
    actionParams = undefined,
    actionFn = undefined,
    class: customClass = '',
    children,
    onclick = () => {},
  }: Props = $props()

  function handleClick() {
    if (!disabled && !useAction) {
      onclick(new CustomEvent('click', { detail: { action } }))
    }
  }
</script>

<div class="tooltip-wrapper">
  {#if useAction && actionFn}
    <button
      class="grid-item-button {customClass}"
      class:disabled
      onclick={handleClick}
      aria-label={label || tooltip}
      use:tooltipAction={{
        content: tooltip || label,
        position: 'top',
        offset: 35,
      }}
      use:actionFn={actionParams!}
    >
      {#if children}
        {@render children()}
      {:else}
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
      class="grid-item-button {customClass}"
      class:disabled
      onclick={handleClick}
      aria-label={label || tooltip}
      use:tooltipAction={{
        content: tooltip || label,
        position: 'top',
        offset: 35,
      }}
    >
      {#if children}
        {@render children()}
      {:else}
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

  .grid-item-button {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 6px;
    color: var(--c-darkgrey, #666);
    background: transparent;
    stroke: var(--c-darkgrey);
    stroke-width: 1.5px;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    transition: all 0.15s ease-out;
    border: none;
  }

  .grid-item-button:hover {
    transform: scale(1.05);
    background: var(--c-midgrey, #e0e0e0);
    color: var(--c-black);
    stroke: var(--c-black);
  }

  .grid-item-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .grid-item-button.disabled:hover {
    transform: none;
    background: var(--c-grey);
    color: var(--c-darkgrey);
  }

  .grid-item-button.move-handle-button {
    cursor: grab;
  }

  .grid-item-button.move-handle-button:active {
    cursor: grabbing;
  }

  .label {
    margin-left: 4px;
  }
</style>
