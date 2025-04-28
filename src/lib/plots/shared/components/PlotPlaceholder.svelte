<script lang="ts">
  let { width, height } = $props<{ width: number; height: number }>()
</script>

<div
  class="placeholder-container"
  style="width: {width}px; height: {height}px;"
>
  <div class="loader">
    <div class="spinner"></div>
    <div class="text">Loading visualization...</div>
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
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: rgba(0, 0, 0, 0.3);
    animation: spin 1.2s ease-in-out infinite;
  }

  .text {
    color: rgba(0, 0, 0, 0.4);
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
