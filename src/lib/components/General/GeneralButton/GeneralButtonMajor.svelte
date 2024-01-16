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
    background-color: #ebebef;
    border: none;
    color: var(--c-black);
    padding: 10px 20px;
    border-radius: 20px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    cursor: pointer;
    font-weight: 600;
  }
  button:hover {
    background-color: #e4e4e9;
  }
  button:disabled {
    background-color: #cccccc;
    color: #666666;
    cursor: not-allowed;
  }
</style>
