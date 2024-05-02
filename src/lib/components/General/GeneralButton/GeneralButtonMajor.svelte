<script lang="ts">
  export let isDisabled = false
</script>

<button disabled={isDisabled} on:pointerdown|stopPropagation on:click>
  <slot />
</button>

<style>
  button {
    background-color: var(--c-lightgrey);
    border: none;
    color: var(--c-black);
    padding: 0.75em 1.5em;
    border-radius: var(--rounded-lg);
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    cursor: pointer;
    font-weight: 600;
  }
  button:hover {
    background-color: var(--c-grey);
  }
  button:disabled {
    color: var(--c-midgrey);
    background-color: var(--c-lightgrey);
    cursor: not-allowed;
  }
</style>
