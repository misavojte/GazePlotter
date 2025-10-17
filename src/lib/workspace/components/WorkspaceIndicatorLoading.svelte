<script lang="ts">
  import { fade } from 'svelte/transition'
  import WorkspaceItemContainer from './WorkspaceItemContainer.svelte'
</script>

<div class="loading-workspace-indicator" transition:fade={{ duration: 400 }}>
  <WorkspaceItemContainer class="indicator-content">
    {#snippet header()}
      <h3>Processing data</h3>
    {/snippet}
    {#snippet body()}
      <div class="content-inner">
        <div class="spinner"></div>
        <div class="text-content">
          <p>
            Please wait while we prepare your visualisations. This may take a moment
            depending on the size of your dataset.
          </p>
        </div>
      </div>
    {/snippet}
  </WorkspaceItemContainer>
</div>

<style>
  .loading-workspace-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  :global(.indicator-content) {
    max-width: 500px;
    width: 100%;
  }

  .content-inner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--c-lightgrey);
    border-top-color: var(--c-primary);
    border-radius: 50%;
    animation: spin 1.2s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .text-content {
    flex: 1;
  }

  p {
    margin: 0;
    color: var(--c-text);
    line-height: 1.5;
    font-size: 14px;
  }

  @media (max-width: 600px) {
    :global(.indicator-content) {
      margin: 0 1rem;
    }
  }
</style>
