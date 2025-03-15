<script lang="ts">
  export let insideGridItem = true
</script>

{#if insideGridItem}
  <div class="loading">
    <div class="spinner"></div>
    <div>Rendering charts</div>
  </div>
{/if}

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    gap: 20px;
  }

  .spinner {
    border: 4px solid var(--c-lightgrey);
    border-left-color: var(--c-brand);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
