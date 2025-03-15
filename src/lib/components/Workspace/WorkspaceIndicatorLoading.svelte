<script lang="ts">
  import { fade } from 'svelte/transition'
</script>

<div class="loading-workspace-indicator" transition:fade={{ duration: 400 }}>
  <div class="content">
    <div class="spinner-container">
      <div class="spinner"></div>
    </div>
    <h2>Processing data</h2>
    <p>
      Please wait while we prepare your visualizations. This may take a moment
      depending on the size of your dataset.
    </p>
    <div class="progress-indicators">
      <div class="progress-dot"></div>
      <div class="progress-dot"></div>
      <div class="progress-dot"></div>
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

  .content {
    max-width: 500px;
    text-align: center;
    background-color: white;
    border-radius: 12px;
    padding: 2.5rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  }

  .spinner-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .spinner {
    width: 60px;
    height: 60px;
    border: 5px solid var(--c-lightgrey);
    border-top-color: var(--c-primary);
    border-radius: 50%;
    animation: spin 1.2s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--c-text-dark);
  }

  p {
    margin: 0 0 1.5rem 0;
    color: var(--c-text);
    line-height: 1.5;
  }

  .progress-indicators {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .progress-dot {
    width: 10px;
    height: 10px;
    background-color: var(--c-primary);
    border-radius: 50%;
    opacity: 0.3;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .progress-dot:nth-child(2) {
    animation-delay: 0.5s;
  }

  .progress-dot:nth-child(3) {
    animation-delay: 1s;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  @media (max-width: 600px) {
    .content {
      margin: 0 1rem;
      padding: 1.5rem;
    }
  }
</style>
