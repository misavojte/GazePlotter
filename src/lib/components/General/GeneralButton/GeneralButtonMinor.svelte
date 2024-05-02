<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let isDisabled = false
  export let isIcon = true

  const handleClick = () => {
    dispatch('click')
  }
</script>

<button
  disabled={isDisabled}
  on:pointerdown|stopPropagation
  on:click={handleClick}
>
  <slot />
</button>

<style>
  button {
    background: none;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    color: var(--c-black);
    padding: 0.25em 0.5em;
    text-align: center;
    text-decoration: none;
    align-items: center;
    justify-content: center;
    display: inline-flex;
    height: 34px;
    min-width: 34px;
    font-size: 16px;
    cursor: pointer;
  }
  button.isIcon {
    width: 34px;
  }
  button:hover {
    border: 1px solid var(--c-brand);
    color: var(--c-brand);
  }
  button:disabled {
    cursor: not-allowed;
    color: var(--c-darkgrey);
    border: 1px solid var(--c-midgrey);
  }
</style>
