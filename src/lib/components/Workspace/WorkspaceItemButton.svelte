<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let label: string = ''
  export let icon: string = ''
  export let action: string = ''
  export let tooltip: string = ''
  export let disabled: boolean = false

  const dispatch = createEventDispatcher<{
    click: { action: string }
  }>()

  function handleClick() {
    if (!disabled) {
      dispatch('click', { action })
    }
  }
</script>

<button
  class="workspace-item-button"
  class:disabled
  on:click={handleClick}
  title={tooltip || label}
  aria-label={label}
>
  <slot>
    {#if icon}
      {@html icon}
    {/if}
    {#if label}
      <span class="label">{label}</span>
    {/if}
  </slot>
</button>

<style>
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
</style>
