<script lang="ts">
  let {
    width,
    height,
    message = 'Loading visualization...',
    loading = true,
  } = $props<{
    width: number
    height: number
    message?: string
    loading?: boolean
  }>()
</script>

<div
  class="placeholder-container"
  style="width: {width}px; height: {height}px;"
>
  <div class="loader">
    {#if loading}
      <div class="spinner"></div>
    {/if}
    <div class="text">{message}</div>
  </div>
</div>

<style>
  .placeholder-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--c-grey);
    border-radius: 50%;
    border-top-color: var(--c-midgrey);
    animation: spin 1.2s ease-in-out infinite;
  }

  .text {
    color: var(--c-darkgrey);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: 0.3px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
