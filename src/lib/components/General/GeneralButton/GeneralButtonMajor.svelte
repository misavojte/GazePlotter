<script lang="ts">
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore.js'

  export let isDisabled = false

  processingFileStateStore.subscribe(isProcessingFile => {
    isDisabled = isProcessingFile === 'processing'
  })
</script>

<button disabled={isDisabled} on:click>
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
    background-color: var(--c-darkgrey);
    color: var(--black);
    cursor: not-allowed;
  }
</style>
