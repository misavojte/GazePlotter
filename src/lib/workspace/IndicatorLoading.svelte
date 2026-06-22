<script lang="ts">
  import { fade } from 'svelte/transition'
  import { getGazePlotterSession } from '$lib/session'

  const { ingest } = getGazePlotterSession()
</script>

<div class="loading-workspace-indicator" transition:fade={{ duration: 400 }}>
  <div class="indicator-card">
    <div class="indicator-header">
      <h3 class="indicator-title">Processing data</h3>
    </div>
    <div class="indicator-body">
      <div class="content-inner">
        <div class="spinner"></div>
        <div class="text-content">
          <p>Please wait while we prepare your visualisations.</p>
          <p>Processing data: {ingest.progressPercent}%</p>
        </div>
      </div>
    </div>
  </div>
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

  .indicator-card {
    max-width: 500px;
    width: 100%;
    box-sizing: border-box;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded-lg);
    border: 1px solid var(--c-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .indicator-header {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background: var(--c-lightgrey);
  }

  .indicator-title {
    margin: 2px 0 2px 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-black);
  }

  .indicator-body {
    padding: 20px;
    background-color: var(--c-white);
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
    border-top-color: var(--c-brand);
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
    .indicator-card {
      margin: 0 1rem;
    }
  }
</style>
